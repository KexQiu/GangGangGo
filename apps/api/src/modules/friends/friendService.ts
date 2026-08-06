import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, lt, or, sql } from 'drizzle-orm';

import type {
  FriendDataResponse,
  FriendResponse,
  FriendSummary,
  FriendsResponse,
  UserSummary,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import {
  dailyActivitySummaries,
  friendEventAcks,
  friendEvents,
  friendInvites,
  friendNudgeDailyCounters,
  friendships,
  friendSettings,
  users,
} from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import type { PushNotificationService } from '../push/pushNotificationService.js';
import { createNoopPushNotificationService } from '../push/pushNotificationService.js';
import type { CurrentUser } from '../users/userTypes.js';
import { publicSettings, toAck, toFriendEvent, toUserSummary, type FriendSettingsRow } from './friend.mapper.js';
import {
  ackNotificationMessages,
  ackRevisionWindowMs,
  addDays,
  calculateHabitStreak,
  canonicalPair,
  createInviteToken,
  createInviteUrl,
  dateKeyInTimezone,
  dateRange,
  emptySummary,
  encodeEventCursor,
  ensureInviteUsable,
  friendLimit,
  hashInviteToken,
  inviteTtlMs,
  isInQuietRanges,
  notifySafely,
  nudgeMessages,
  nudgeTtlMs,
  otherUserId,
  parseEventCursor,
  projectDay,
  settingsKey,
  trainingTarget,
} from './friend.policy.js';
import type { FriendService } from './friend.types.js';

async function findFriendship(db: Database, userId: string, friendUserId: string) {
  const pair = canonicalPair(userId, friendUserId);
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.lowerUserId, pair.lowerUserId), eq(friendships.upperUserId, pair.upperUserId)))
    .limit(1);
  return friendship ?? null;
}

async function requireFriendship(db: Database, userId: string, friendUserId: string) {
  if (userId === friendUserId) throw new ApiError(400, 'bad_request', '不能把自己当作好友。');
  const friendship = await findFriendship(db, userId, friendUserId);
  if (!friendship) throw new ApiError(404, 'not_found', '没有找到这个好友。');
  return friendship;
}

export function createDrizzleFriendService(
  db: Database,
  options: { pushNotificationService?: PushNotificationService } = {},
): FriendService {
  const pushNotificationService = options.pushNotificationService ?? createNoopPushNotificationService();

  async function listBundle(currentUser: CurrentUser) {
    const friendshipRows = await db
      .select()
      .from(friendships)
      .where(or(eq(friendships.lowerUserId, currentUser.id), eq(friendships.upperUserId, currentUser.id)))
      .orderBy(desc(friendships.createdAt));
    if (friendshipRows.length === 0) {
      return { acks: [], events: [], friendships: [], pending: [], settings: [], summaries: [], userRows: [] };
    }
    const friendshipIds = friendshipRows.map((row) => row.id);
    const friendUserIds = friendshipRows.map((row) => otherUserId(row, currentUser.id));
    const utcDate = new Date().toISOString().slice(0, 10);
    const [settingsRows, eventRows, userRows, summaryRows, pendingRows] = await Promise.all([
      db.select().from(friendSettings).where(inArray(friendSettings.friendshipId, friendshipIds)),
      db
        .selectDistinctOn([friendEvents.friendshipId])
        .from(friendEvents)
        .where(inArray(friendEvents.friendshipId, friendshipIds))
        .orderBy(friendEvents.friendshipId, desc(friendEvents.occurredAt), desc(friendEvents.id)),
      db
        .select()
        .from(users)
        .where(and(inArray(users.id, [currentUser.id, ...friendUserIds]), isNull(users.deletedAt))),
      db
        .select()
        .from(dailyActivitySummaries)
        .where(
          and(
            inArray(dailyActivitySummaries.userId, friendUserIds),
            gte(dailyActivitySummaries.localDate, addDays(utcDate, -91)),
            lte(dailyActivitySummaries.localDate, addDays(utcDate, 1)),
          ),
        ),
      db
        .select({ friendshipId: friendEvents.friendshipId, value: count() })
        .from(friendEvents)
        .leftJoin(
          friendEventAcks,
          and(eq(friendEventAcks.eventId, friendEvents.id), eq(friendEventAcks.userId, currentUser.id)),
        )
        .where(
          and(
            inArray(friendEvents.friendshipId, friendshipIds),
            eq(friendEvents.kind, 'manual_nudge'),
            eq(friendEvents.toUserId, currentUser.id),
            gt(friendEvents.expiresAt, new Date()),
            isNull(friendEventAcks.id),
          ),
        )
        .groupBy(friendEvents.friendshipId),
    ]);
    const eventIds = eventRows.filter((event) => event.kind === 'manual_nudge').map((event) => event.id);
    const acks = eventIds.length
      ? await db.select().from(friendEventAcks).where(inArray(friendEventAcks.eventId, eventIds))
      : [];
    return {
      acks,
      events: eventRows,
      friendships: friendshipRows,
      pending: pendingRows,
      settings: settingsRows,
      summaries: summaryRows,
      userRows,
    };
  }

  async function listFriends(currentUser: CurrentUser): Promise<FriendsResponse> {
    const bundle = await listBundle(currentUser);
    const usersById = new Map(bundle.userRows.map((row) => [row.id, toUserSummary(row)]));
    const userRowsById = new Map(bundle.userRows.map((row) => [row.id, row]));
    const settingsByKey = new Map(bundle.settings.map((row) => [settingsKey(row.friendshipId, row.userId), row]));
    const acksByEventId = new Map(bundle.acks.map((row) => [row.eventId, row]));
    const summaryByUserDate = new Map(bundle.summaries.map((row) => [`${row.userId}:${row.localDate}`, row.summary]));
    const latestEventByFriendship = new Map(bundle.events.map((event) => [event.friendshipId, event]));
    const pendingByFriendship = new Map(bundle.pending.map((row) => [row.friendshipId, row.value]));

    const friends: FriendSummary[] = bundle.friendships.map((friendship) => {
      const friendUserId = otherUserId(friendship, currentUser.id);
      const friend = usersById.get(friendUserId);
      const friendRow = userRowsById.get(friendUserId);
      if (!friend || !friendRow) throw new Error('Friendship contains a missing user.');
      const friendOwnedSettings = settingsByKey.get(settingsKey(friendship.id, friendUserId));
      const grantedToMe = publicSettings(friendOwnedSettings);
      const today = dateKeyInTimezone(friendRow.timezone);
      const summary = summaryByUserDate.get(`${friendUserId}:${today}`) ?? emptySummary(today);
      const latest = latestEventByFriendship.get(friendship.id);
      const settingsByOwner = new Map<string, FriendSettingsRow>();
      for (const row of bundle.settings.filter((item) => item.friendshipId === friendship.id)) {
        settingsByOwner.set(row.userId, row);
      }
      return {
        createdAt: friendship.createdAt.toISOString(),
        dataPreview: {
          date: today,
          habitCompletion: grantedToMe.habitLevel === 'none' ? null : summary.habit.completionCount,
          streakDays:
            grantedToMe.habitLevel === 'none' ? null : calculateHabitStreak(summaryByUserDate, friendUserId, today),
          toiletRecorded: grantedToMe.toiletLevel === 'none' ? null : summary.toilet.sessionCount > 0,
          trainingDone:
            grantedToMe.trainingLevel === 'none' ? null : summary.training.completedSessionCount >= trainingTarget,
        },
        friend,
        friendshipId: friendship.id,
        latestEvent: latest
          ? toFriendEvent({
              ack: acksByEventId.get(latest.id),
              event: latest,
              requesterId: currentUser.id,
              settingsByOwner,
              usersById,
            })
          : null,
        pendingCount: pendingByFriendship.get(friendship.id) ?? 0,
      };
    });
    return { friends };
  }

  async function getFriend(currentUser: CurrentUser, friendUserId: string): Promise<FriendResponse> {
    const friendship = await requireFriendship(db, currentUser.id, friendUserId);
    const [summary, settingsRows] = await Promise.all([
      listFriends(currentUser).then((response) => response.friends.find((item) => item.friend.id === friendUserId)),
      db.select().from(friendSettings).where(eq(friendSettings.friendshipId, friendship.id)),
    ]);
    if (!summary) throw new ApiError(404, 'not_found', '没有找到这个好友。');
    const mySettings = publicSettings(settingsRows.find((row) => row.userId === currentUser.id));
    const friendOwnedSettings = publicSettings(settingsRows.find((row) => row.userId === friendUserId));
    return {
      friend: {
        ...summary,
        friendSettings: friendOwnedSettings,
        mySettings,
        toiletNotificationsActive:
          mySettings.notifyFriendOnToiletEnd && friendOwnedSettings.allowToiletEndNotificationsFromFriend,
      },
    };
  }

  return {
    async acceptInvite(currentUser, token) {
      const [invite] = await db
        .select()
        .from(friendInvites)
        .where(eq(friendInvites.tokenHash, hashInviteToken(token)))
        .limit(1);
      if (!invite) throw new ApiError(404, 'not_found', '没有找到这个好友邀请。');
      ensureInviteUsable(invite);
      if (invite.inviterUserId === currentUser.id) throw new ApiError(400, 'bad_request', '不能接受自己的好友邀请。');
      const pair = canonicalPair(invite.inviterUserId, currentUser.id);
      await db.transaction(async (transaction) => {
        for (const userId of [pair.lowerUserId, pair.upperUserId]) {
          await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
        }
        const counts = await Promise.all(
          [invite.inviterUserId, currentUser.id].map(async (userId) => {
            const [row] = await transaction
              .select({ value: count() })
              .from(friendships)
              .where(or(eq(friendships.lowerUserId, userId), eq(friendships.upperUserId, userId)));
            return row?.value ?? 0;
          }),
        );
        if (counts.some((value) => value >= friendLimit))
          throw new ApiError(409, 'conflict', '好友数量已经达到 20 人上限。');
        const existing = await transaction
          .select({ id: friendships.id })
          .from(friendships)
          .where(and(eq(friendships.lowerUserId, pair.lowerUserId), eq(friendships.upperUserId, pair.upperUserId)))
          .limit(1);
        if (existing.length) throw new ApiError(409, 'conflict', '你们已经是好友了。');
        const [accepted] = await transaction
          .update(friendInvites)
          .set({ acceptedAt: new Date(), acceptedByUserId: currentUser.id })
          .where(
            and(
              eq(friendInvites.id, invite.id),
              isNull(friendInvites.acceptedAt),
              isNull(friendInvites.revokedAt),
              gt(friendInvites.expiresAt, new Date()),
            ),
          )
          .returning({ id: friendInvites.id });
        if (!accepted) throw new ApiError(409, 'conflict', '这个好友邀请已经不能使用了。');
        const [friendship] = await transaction.insert(friendships).values(pair).returning({ id: friendships.id });
        if (!friendship) throw new Error('Failed to create friendship.');
        await transaction.insert(friendSettings).values([
          { friendshipId: friendship.id, userId: invite.inviterUserId },
          { friendshipId: friendship.id, userId: currentUser.id },
        ]);
      });
      return getFriend(currentUser, invite.inviterUserId);
    },
    async ackNudge(currentUser, eventId, status) {
      const [event] = await db.select().from(friendEvents).where(eq(friendEvents.id, eventId)).limit(1);
      if (!event || event.kind !== 'manual_nudge') throw new ApiError(404, 'not_found', '没有找到这条好友提醒。');
      if (event.toUserId !== currentUser.id) throw new ApiError(403, 'forbidden', '只能回复发给自己的提醒。');
      if (!event.expiresAt || event.expiresAt.getTime() <= Date.now()) {
        throw new ApiError(409, 'conflict', '这条好友提醒已经过期。');
      }
      await requireFriendship(db, currentUser.id, event.fromUserId);
      const [created] = await db
        .insert(friendEventAcks)
        .values({ eventId, status, userId: currentUser.id })
        .onConflictDoNothing({ target: [friendEventAcks.eventId, friendEventAcks.userId] })
        .returning();
      let ack = created;
      if (!ack) {
        const [existing] = await db
          .select()
          .from(friendEventAcks)
          .where(and(eq(friendEventAcks.eventId, eventId), eq(friendEventAcks.userId, currentUser.id)))
          .limit(1);
        if (!existing) throw new Error('Failed to load friend nudge acknowledgement.');
        if (existing.status === status) return { ack: toAck(existing) };
        const now = new Date();
        const [updated] = await db
          .update(friendEventAcks)
          .set({ revisionCount: 1, status, updatedAt: now })
          .where(
            and(
              eq(friendEventAcks.id, existing.id),
              eq(friendEventAcks.revisionCount, 0),
              gt(friendEventAcks.createdAt, new Date(now.getTime() - ackRevisionWindowMs)),
            ),
          )
          .returning();
        if (!updated) throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
        ack = updated;
      }
      await notifySafely(pushNotificationService, {
        body: ackNotificationMessages[status],
        data: { eventId, friendUserId: currentUser.id, kind: 'friend-nudge-ack', status },
        title: '好友有回音了',
        userId: event.fromUserId,
      });
      return { ack: toAck(ack) };
    },
    async createInvite(currentUser) {
      const [friendCount] = await db
        .select({ value: count() })
        .from(friendships)
        .where(or(eq(friendships.lowerUserId, currentUser.id), eq(friendships.upperUserId, currentUser.id)));
      if ((friendCount?.value ?? 0) >= friendLimit) throw new ApiError(409, 'conflict', '好友数量已经达到 20 人上限。');
      const token = createInviteToken();
      const expiresAt = new Date(Date.now() + inviteTtlMs);
      const [invite] = await db
        .insert(friendInvites)
        .values({ expiresAt, inviterUserId: currentUser.id, tokenHash: hashInviteToken(token) })
        .returning({ id: friendInvites.id });
      if (!invite) throw new Error('Failed to create friend invite.');
      return { expiresAt: expiresAt.toISOString(), inviteId: invite.id, inviteUrl: createInviteUrl(token), token };
    },
    async deleteFriend(currentUser, friendUserId) {
      const friendship = await requireFriendship(db, currentUser.id, friendUserId);
      await db.delete(friendships).where(eq(friendships.id, friendship.id));
    },
    getFriend,
    async getFriendData(currentUser, friendUserId) {
      const friendship = await requireFriendship(db, currentUser.id, friendUserId);
      const [friendRow, ownerSettingsRow] = await Promise.all([
        db
          .select()
          .from(users)
          .where(and(eq(users.id, friendUserId), isNull(users.deletedAt)))
          .limit(1),
        db
          .select()
          .from(friendSettings)
          .where(and(eq(friendSettings.friendshipId, friendship.id), eq(friendSettings.userId, friendUserId)))
          .limit(1),
      ]);
      const friend = friendRow[0];
      if (!friend) throw new ApiError(404, 'not_found', '没有找到这个好友。');
      const settings = publicSettings(ownerSettingsRow[0]);
      const endedAt = dateKeyInTimezone(friend.timezone);
      const historyDates = dateRange(endedAt, settings.historyDays);
      const calculationStart = addDays(endedAt, -89);
      const rows = await db
        .select()
        .from(dailyActivitySummaries)
        .where(
          and(
            eq(dailyActivitySummaries.userId, friendUserId),
            gte(dailyActivitySummaries.localDate, calculationStart),
            lte(dailyActivitySummaries.localDate, endedAt),
          ),
        )
        .orderBy(asc(dailyActivitySummaries.localDate));
      const summariesByDate = new Map(rows.map((row) => [row.localDate, row.summary]));
      const streaksByDate = new Map<string, number>();
      let streak = 0;
      for (const date of dateRange(endedAt, 90)) {
        const summary = summariesByDate.get(date) ?? emptySummary(date);
        streak = summary.habit.completionCount === 4 ? streak + 1 : 0;
        streaksByDate.set(date, streak);
      }
      return {
        days: historyDates.map((date) =>
          projectDay(summariesByDate.get(date) ?? emptySummary(date), settings, streaksByDate.get(date) ?? 0),
        ),
        friend: toUserSummary(friend),
        historyDays: settings.historyDays,
      } satisfies FriendDataResponse;
    },
    async listEvents(currentUser, friendUserId, options) {
      const friendship = await requireFriendship(db, currentUser.id, friendUserId);
      const cursor = parseEventCursor(options.before);
      const rows = await db
        .select()
        .from(friendEvents)
        .where(
          cursor
            ? and(
                eq(friendEvents.friendshipId, friendship.id),
                or(
                  lt(friendEvents.occurredAt, cursor.occurredAt),
                  and(eq(friendEvents.occurredAt, cursor.occurredAt), lt(friendEvents.id, cursor.id)),
                ),
              )
            : eq(friendEvents.friendshipId, friendship.id),
        )
        .orderBy(desc(friendEvents.occurredAt), desc(friendEvents.id))
        .limit(options.limit + 1);
      const page = rows.slice(0, options.limit);
      const participantIds = [currentUser.id, friendUserId];
      const eventIds = page.filter((event) => event.kind === 'manual_nudge').map((event) => event.id);
      const [userRows, settingsRows, ackRows] = await Promise.all([
        db.select().from(users).where(inArray(users.id, participantIds)),
        db.select().from(friendSettings).where(eq(friendSettings.friendshipId, friendship.id)),
        eventIds.length ? db.select().from(friendEventAcks).where(inArray(friendEventAcks.eventId, eventIds)) : [],
      ]);
      const usersById = new Map(userRows.map((row) => [row.id, toUserSummary(row)]));
      const settingsByOwner = new Map(settingsRows.map((row) => [row.userId, row]));
      const acksByEventId = new Map(ackRows.map((row) => [row.eventId, row]));
      const hasMore = rows.length > options.limit;
      return {
        events: page.map((event) =>
          toFriendEvent({
            ack: acksByEventId.get(event.id),
            event,
            requesterId: currentUser.id,
            settingsByOwner,
            usersById,
          }),
        ),
        hasMore,
        nextCursor: hasMore && page.at(-1) ? encodeEventCursor(page.at(-1)!) : null,
      };
    },
    listFriends,
    async previewInvite(token) {
      const [row] = await db
        .select({
          acceptedAt: friendInvites.acceptedAt,
          avatarUrl: users.avatarUrl,
          expiresAt: friendInvites.expiresAt,
          inviterUserId: friendInvites.inviterUserId,
          nickname: users.nickname,
          revokedAt: friendInvites.revokedAt,
        })
        .from(friendInvites)
        .innerJoin(users, eq(friendInvites.inviterUserId, users.id))
        .where(and(eq(friendInvites.tokenHash, hashInviteToken(token)), isNull(users.deletedAt)))
        .limit(1);
      if (!row) throw new ApiError(404, 'not_found', '没有找到这个好友邀请。');
      ensureInviteUsable(row);
      return {
        expiresAt: row.expiresAt.toISOString(),
        inviter: toUserSummary({ avatarUrl: row.avatarUrl, id: row.inviterUserId, nickname: row.nickname }),
      };
    },
    async recordToiletFinished(currentUser, event) {
      const friendshipRows = await db
        .select()
        .from(friendships)
        .where(or(eq(friendships.lowerUserId, currentUser.id), eq(friendships.upperUserId, currentUser.id)));
      if (!friendshipRows.length) return;
      const friendshipIds = friendshipRows.map((row) => row.id);
      const recipientIds = friendshipRows.map((row) => otherUserId(row, currentUser.id));
      const [settingsRows, recipientRows] = await Promise.all([
        db.select().from(friendSettings).where(inArray(friendSettings.friendshipId, friendshipIds)),
        db
          .select()
          .from(users)
          .where(and(inArray(users.id, recipientIds), isNull(users.deletedAt))),
      ]);
      const settingsByKey = new Map(settingsRows.map((row) => [settingsKey(row.friendshipId, row.userId), row]));
      const recipientsById = new Map(recipientRows.map((row) => [row.id, row]));
      const endedAt = new Date(event.endedAt);
      if (Number.isNaN(endedAt.getTime())) return;
      for (const friendship of friendshipRows) {
        const recipientId = otherUserId(friendship, currentUser.id);
        const senderSettings = settingsByKey.get(settingsKey(friendship.id, currentUser.id));
        const recipientSettings = settingsByKey.get(settingsKey(friendship.id, recipientId));
        const recipient = recipientsById.get(recipientId);
        if (
          !senderSettings?.notifyFriendOnToiletEnd ||
          !recipientSettings?.allowToiletEndNotificationsFromFriend ||
          !senderSettings.notifyFriendOnToiletEndEnabledAt ||
          !recipientSettings.allowToiletEndNotificationsEnabledAt ||
          endedAt < senderSettings.notifyFriendOnToiletEndEnabledAt ||
          endedAt < recipientSettings.allowToiletEndNotificationsEnabledAt ||
          !recipient
        ) {
          continue;
        }
        const [created] = await db
          .insert(friendEvents)
          .values({
            durationSeconds: event.durationSeconds,
            friendshipId: friendship.id,
            fromUserId: currentUser.id,
            kind: 'toilet_finished',
            occurredAt: endedAt,
            sourceEntityId: event.sourceEntityId,
            toUserId: recipientId,
          })
          .onConflictDoNothing()
          .returning({ id: friendEvents.id });
        if (!created || isInQuietRanges(recipientSettings.quietRanges, recipient.timezone)) continue;
        const nickname = currentUser.nickname ?? '你的好友';
        const canSeeDuration = senderSettings.toiletLevel === 'detailed';
        await notifySafely(pushNotificationService, {
          body: canSeeDuration
            ? `${nickname}刚结束蹲会儿，本次 ${Math.max(1, Math.round(event.durationSeconds / 60))} 分钟。`
            : `${nickname}刚结束蹲会儿。`,
          data: { eventId: created.id, friendUserId: currentUser.id, kind: 'friend-toilet-finished' },
          title: '好友刚收工',
          userId: recipientId,
        });
      }
    },
    async sendNudge(currentUser, friendUserId, input) {
      const friendship = await requireFriendship(db, currentUser.id, friendUserId);
      const [recipientSettingsRow, recipientRow] = await Promise.all([
        db
          .select()
          .from(friendSettings)
          .where(and(eq(friendSettings.friendshipId, friendship.id), eq(friendSettings.userId, friendUserId)))
          .limit(1),
        db
          .select()
          .from(users)
          .where(and(eq(users.id, friendUserId), isNull(users.deletedAt)))
          .limit(1),
      ]);
      const recipientSettings = publicSettings(recipientSettingsRow[0]);
      const recipient = recipientRow[0];
      if (!recipient) throw new ApiError(404, 'not_found', '没有找到这个好友。');
      if (!recipientSettings.nudgesEnabled || recipientSettings.nudgeDailyLimit === 0) {
        throw new ApiError(403, 'forbidden', '这个好友暂时关闭了主动提醒。');
      }
      if (isInQuietRanges(recipientSettings.quietRanges, recipient.timezone)) {
        throw new ApiError(403, 'forbidden', '现在是好友的免打扰时间。');
      }
      const now = new Date();
      const localDate = dateKeyInTimezone(recipient.timezone, now);
      const created = await db.transaction(async (transaction) => {
        const [counter] = await transaction
          .insert(friendNudgeDailyCounters)
          .values({
            count: 1,
            friendshipId: friendship.id,
            fromUserId: currentUser.id,
            localDate,
            toUserId: friendUserId,
          })
          .onConflictDoUpdate({
            set: { count: sql`${friendNudgeDailyCounters.count} + 1`, updatedAt: now },
            target: [
              friendNudgeDailyCounters.friendshipId,
              friendNudgeDailyCounters.fromUserId,
              friendNudgeDailyCounters.toUserId,
              friendNudgeDailyCounters.localDate,
            ],
          })
          .returning({ count: friendNudgeDailyCounters.count });
        if (!counter || counter.count > recipientSettings.nudgeDailyLimit) {
          throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
        }
        const [event] = await transaction
          .insert(friendEvents)
          .values({
            expiresAt: new Date(now.getTime() + nudgeTtlMs),
            friendshipId: friendship.id,
            fromUserId: currentUser.id,
            kind: 'manual_nudge',
            message: nudgeMessages[input.type],
            nudgeType: input.type,
            occurredAt: now,
            toUserId: friendUserId,
          })
          .returning();
        if (!event) throw new Error('Failed to create friend nudge.');
        return event;
      });
      await notifySafely(pushNotificationService, {
        body: nudgeMessages[input.type],
        data: { eventId: created.id, friendUserId: currentUser.id, kind: 'friend-nudge', type: input.type },
        title: '好友轻轻戳了你一下',
        userId: friendUserId,
      });
      const usersById = new Map<string, UserSummary>([
        [currentUser.id, currentUser],
        [friendUserId, toUserSummary(recipient)],
      ]);
      return toFriendEvent({
        event: created,
        requesterId: currentUser.id,
        settingsByOwner: new Map(recipientSettingsRow.map((row) => [row.userId, row])),
        usersById,
      });
    },
    async updateSettings(currentUser, friendUserId, input) {
      const friendship = await requireFriendship(db, currentUser.id, friendUserId);
      const [existing] = await db
        .select()
        .from(friendSettings)
        .where(and(eq(friendSettings.friendshipId, friendship.id), eq(friendSettings.userId, currentUser.id)))
        .limit(1);
      if (!existing) throw new Error('Friend settings are missing.');
      const now = new Date();
      const notifyEnabledAt =
        input.notifyFriendOnToiletEnd === undefined
          ? existing.notifyFriendOnToiletEndEnabledAt
          : input.notifyFriendOnToiletEnd
            ? existing.notifyFriendOnToiletEnd
              ? existing.notifyFriendOnToiletEndEnabledAt
              : now
            : null;
      const allowEnabledAt =
        input.allowToiletEndNotificationsFromFriend === undefined
          ? existing.allowToiletEndNotificationsEnabledAt
          : input.allowToiletEndNotificationsFromFriend
            ? existing.allowToiletEndNotificationsFromFriend
              ? existing.allowToiletEndNotificationsEnabledAt
              : now
            : null;
      await db
        .update(friendSettings)
        .set({
          ...input,
          allowToiletEndNotificationsEnabledAt: allowEnabledAt,
          notifyFriendOnToiletEndEnabledAt: notifyEnabledAt,
          updatedAt: now,
        })
        .where(eq(friendSettings.id, existing.id));
      return getFriend(currentUser, friendUserId);
    },
  };
}

export { createMockFriendService } from './friend.mock.js';
export { defaultFriendSettings } from './friend.policy.js';
export type { FriendService, ToiletFinishedSyncEvent } from './friend.types.js';
