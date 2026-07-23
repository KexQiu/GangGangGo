import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, lt, or, sql } from 'drizzle-orm';

import type {
  CreateFriendInviteResponse,
  CreateFriendNudgeRequest,
  DailyActivitySummary,
  FriendDataResponse,
  FriendEvent,
  FriendEventsResponse,
  FriendInvitePreviewResponse,
  FriendNudgeAckResponse,
  FriendNudgeAckStatus,
  FriendResponse,
  FriendSettings,
  FriendSharedDay,
  FriendSummary,
  FriendsResponse,
  UpdateFriendSettingsRequest,
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
import { deserializeAvatarConfig } from '../users/avatarConfig.js';
import type { CurrentUser } from '../users/userTypes.js';

const friendLimit = 20;
const inviteTtlMs = 7 * 24 * 60 * 60 * 1000;
const nudgeTtlMs = 24 * 60 * 60 * 1000;
const ackRevisionWindowMs = 30 * 60 * 1000;
const defaultTimezone = 'Asia/Shanghai';
const trainingTarget = 2;

const nudgeMessages: Record<CreateFriendNudgeRequest['type'], string> = {
  gentle: '轻轻戳一下，今天别空白。',
  habit_left: '小账本还差一笔，顺手把今天补完整。',
  move: '起来走两步，给身体换个档。',
  not_blank: '今天留一点小进展，哪怕很小也算数。',
  posture: '肩颈松一下，别把自己拧住。',
};

const ackNotificationMessages: Record<FriendNudgeAckStatus, string> = {
  done: '对方说已完成。',
  later: '对方说等会儿。',
  received: '对方说收到了。',
};

export const defaultFriendSettings: FriendSettings = {
  allowToiletEndNotificationsFromFriend: false,
  habitLevel: 'none',
  historyDays: 1,
  notifyFriendOnToiletEnd: false,
  nudgeDailyLimit: 5,
  nudgesEnabled: true,
  quietRanges: [],
  toiletLevel: 'none',
  trainingLevel: 'none',
};

export type ToiletFinishedSyncEvent = {
  durationSeconds: number;
  endedAt: string;
  sourceEntityId: string;
};

export type FriendService = {
  acceptInvite: (currentUser: CurrentUser, token: string) => Promise<FriendResponse>;
  ackNudge: (
    currentUser: CurrentUser,
    eventId: string,
    status: FriendNudgeAckStatus,
  ) => Promise<FriendNudgeAckResponse>;
  createInvite: (currentUser: CurrentUser) => Promise<CreateFriendInviteResponse>;
  deleteFriend: (currentUser: CurrentUser, friendUserId: string) => Promise<void>;
  getFriend: (currentUser: CurrentUser, friendUserId: string) => Promise<FriendResponse>;
  getFriendData: (currentUser: CurrentUser, friendUserId: string) => Promise<FriendDataResponse>;
  listEvents: (
    currentUser: CurrentUser,
    friendUserId: string,
    options: { before?: string; limit: number },
  ) => Promise<FriendEventsResponse>;
  listFriends: (currentUser: CurrentUser) => Promise<FriendsResponse>;
  previewInvite: (token: string) => Promise<FriendInvitePreviewResponse>;
  recordToiletFinished: (currentUser: CurrentUser, event: ToiletFinishedSyncEvent) => Promise<void>;
  sendNudge: (currentUser: CurrentUser, friendUserId: string, input: CreateFriendNudgeRequest) => Promise<FriendEvent>;
  updateSettings: (
    currentUser: CurrentUser,
    friendUserId: string,
    input: UpdateFriendSettingsRequest,
  ) => Promise<FriendResponse>;
};

type FriendshipRow = typeof friendships.$inferSelect;
type FriendSettingsRow = typeof friendSettings.$inferSelect;
type FriendEventRow = typeof friendEvents.$inferSelect;
type FriendAckRow = typeof friendEventAcks.$inferSelect;
type UserRow = typeof users.$inferSelect;

function publicSettings(row: FriendSettingsRow | undefined): FriendSettings {
  if (!row) return defaultFriendSettings;
  return {
    allowToiletEndNotificationsFromFriend: row.allowToiletEndNotificationsFromFriend,
    habitLevel: row.habitLevel,
    historyDays: row.historyDays as FriendSettings['historyDays'],
    notifyFriendOnToiletEnd: row.notifyFriendOnToiletEnd,
    nudgeDailyLimit: row.nudgeDailyLimit as FriendSettings['nudgeDailyLimit'],
    nudgesEnabled: row.nudgesEnabled,
    quietRanges: row.quietRanges,
    toiletLevel: row.toiletLevel,
    trainingLevel: row.trainingLevel,
  };
}

function toUserSummary(row: Pick<UserRow, 'avatarUrl' | 'id' | 'nickname'>): UserSummary {
  return {
    avatarUrl: deserializeAvatarConfig(row.avatarUrl),
    id: row.id,
    nickname: row.nickname,
  };
}

function canonicalPair(left: string, right: string) {
  return left.localeCompare(right) < 0
    ? { lowerUserId: left, upperUserId: right }
    : { lowerUserId: right, upperUserId: left };
}

function otherUserId(friendship: FriendshipRow, userId: string) {
  return friendship.lowerUserId === userId ? friendship.upperUserId : friendship.lowerUserId;
}

function settingsKey(friendshipId: string, userId: string) {
  return `${friendshipId}:${userId}`;
}

function dateKeyInTimezone(timezone: string | null | undefined, now = new Date()) {
  try {
    const values = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone || defaultTimezone,
        year: 'numeric',
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function addDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + amount));
  return value.toISOString().slice(0, 10);
}

function dateRange(endedAt: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(endedAt, index - days + 1));
}

function calculateHabitStreak(summariesByUserDate: Map<string, DailyActivitySummary>, userId: string, endedAt: string) {
  let streak = 0;
  for (const date of dateRange(endedAt, 90)) {
    streak = summariesByUserDate.get(`${userId}:${date}`)?.habit.completionCount === 4 ? streak + 1 : 0;
  }
  return streak;
}

function isInQuietRanges(ranges: FriendSettings['quietRanges'], timezone: string, now = new Date()) {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        timeZone: timezone,
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
  } catch {
    return false;
  }
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  return ranges.some((range) => {
    const [startHour, startMinute] = range.start.split(':').map(Number);
    const [endHour, endMinute] = range.end.split(':').map(Number);
    const start = startHour! * 60 + startMinute!;
    const end = endHour! * 60 + endMinute!;
    if (start === end) return true;
    return start < end ? current >= start && current < end : current >= start || current < end;
  });
}

function toAck(row: FriendAckRow) {
  return {
    createdAt: row.createdAt.toISOString(),
    revisionCount: row.revisionCount as 0 | 1,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFriendEvent(input: {
  ack?: FriendAckRow;
  event: FriendEventRow;
  requesterId: string;
  settingsByOwner: Map<string, FriendSettingsRow>;
  usersById: Map<string, UserSummary>;
}): FriendEvent {
  const { event } = input;
  const fromUser = input.usersById.get(event.fromUserId);
  const toUser = input.usersById.get(event.toUserId);
  if (!fromUser || !toUser) throw new Error('Friend event contains a missing user.');
  const base = {
    createdAt: event.createdAt.toISOString(),
    friendshipId: event.friendshipId,
    fromUser,
    id: event.id,
    occurredAt: event.occurredAt.toISOString(),
    toUser,
  };
  if (event.kind === 'manual_nudge') {
    if (!event.expiresAt || !event.message || !event.nudgeType) throw new Error('Invalid manual friend nudge.');
    return {
      ...base,
      ack: input.ack ? toAck(input.ack) : null,
      expiresAt: event.expiresAt.toISOString(),
      kind: 'manual_nudge',
      message: event.message,
      nudgeType: event.nudgeType,
    };
  }
  const ownerSettings = input.settingsByOwner.get(event.fromUserId);
  const canSeeDuration = input.requesterId === event.fromUserId || ownerSettings?.toiletLevel === 'detailed';
  return {
    ...base,
    durationSeconds: canSeeDuration ? event.durationSeconds : null,
    kind: 'toilet_finished',
  };
}

async function notifySafely(
  service: PushNotificationService,
  payload: Parameters<PushNotificationService['sendToUser']>[0],
) {
  try {
    await service.sendToUser(payload);
  } catch {
    // The in-app event is authoritative; push failure must not roll back domain state.
  }
}

function createInviteToken() {
  return randomBytes(24).toString('base64url');
}

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createInviteUrl(token: string) {
  return `xiaotidu://friend/join/${token}`;
}

function ensureInviteUsable(invite: { acceptedAt: Date | null; expiresAt: Date; revokedAt: Date | null }) {
  if (invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(404, 'not_found', '这个好友邀请已经失效。');
  }
  if (invite.acceptedAt) throw new ApiError(409, 'conflict', '这个好友邀请已经被使用过了。');
}

function encodeEventCursor(event: Pick<FriendEventRow, 'id' | 'occurredAt'>) {
  return Buffer.from(`${event.occurredAt.toISOString()}\n${event.id}`).toString('base64url');
}

function parseEventCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const [occurredAtValue, id, ...rest] = Buffer.from(value, 'base64url').toString('utf8').split('\n');
    const occurredAt = new Date(occurredAtValue ?? '');
    if (
      rest.length > 0 ||
      Number.isNaN(occurredAt.getTime()) ||
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new Error('invalid cursor');
    }
    return { id, occurredAt };
  } catch {
    throw new ApiError(400, 'bad_request', '好友互动游标无效。');
  }
}

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

function emptySummary(date: string): DailyActivitySummary {
  return {
    date,
    habit: { bowel: null, completionCount: 0, fiber: null, movement: null, water: null },
    toilet: {
      attentionCount: 0,
      colorCounts: {},
      feelingCounts: {},
      longSessionCount: 0,
      maxDurationSeconds: 0,
      medianDurationSeconds: 0,
      sessionCount: 0,
      shapeCounts: {},
      signalCounts: {},
      totalDurationSeconds: 0,
    },
    training: { completedRepetitions: 0, completedSessionCount: 0, totalDurationSeconds: 0 },
  };
}

function projectDay(summary: DailyActivitySummary, settings: FriendSettings, streakDays: number): FriendSharedDay {
  const trainingDone = summary.training.completedSessionCount >= trainingTarget;
  const toiletRecorded = summary.toilet.sessionCount > 0;
  return {
    date: summary.date,
    habit:
      settings.habitLevel === 'none'
        ? { level: 'none' }
        : settings.habitLevel === 'summary'
          ? { completionCount: summary.habit.completionCount, level: 'summary', streakDays }
          : { ...summary.habit, level: 'detailed', streakDays },
    toilet:
      settings.toiletLevel === 'none'
        ? { level: 'none' }
        : settings.toiletLevel === 'summary'
          ? { level: 'summary', toiletRecorded }
          : { ...summary.toilet, level: 'detailed', toiletRecorded },
    training:
      settings.trainingLevel === 'none'
        ? { level: 'none' }
        : settings.trainingLevel === 'summary'
          ? { level: 'summary', trainingDone }
          : { ...summary.training, level: 'detailed', trainingDone },
  };
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

type MockFriendship = {
  createdAt: Date;
  id: string;
  settings: Map<string, FriendSettings & { allowEnabledAt: Date | null; notifyEnabledAt: Date | null }>;
  toiletEventSourceIds: Set<string>;
  users: [CurrentUser, CurrentUser];
};

export function createMockFriendService(
  options: { pushNotificationService?: PushNotificationService } = {},
): FriendService {
  const pushNotificationService = options.pushNotificationService ?? createNoopPushNotificationService();
  const invites = new Map<string, { acceptedAt: Date | null; expiresAt: Date; id: string; inviter: CurrentUser }>();
  const friendshipRows = new Map<string, MockFriendship>();
  const events = new Map<string, FriendEvent[]>();
  const nudgeCounters = new Map<string, number>();

  function findMockFriendship(userId: string, friendUserId: string) {
    return [...friendshipRows.values()].find(
      (row) => row.users.some((user) => user.id === userId) && row.users.some((user) => user.id === friendUserId),
    );
  }

  function requireMockFriendship(userId: string, friendUserId: string) {
    const row = findMockFriendship(userId, friendUserId);
    if (!row) throw new ApiError(404, 'not_found', '没有找到这个好友。');
    return row;
  }

  function mockSummary(row: MockFriendship, currentUser: CurrentUser): FriendSummary {
    const friend = row.users.find((user) => user.id !== currentUser.id)!;
    const thread = events.get(row.id) ?? [];
    const settings = row.settings.get(friend.id) ?? {
      ...defaultFriendSettings,
      allowEnabledAt: null,
      notifyEnabledAt: null,
    };
    return {
      createdAt: row.createdAt.toISOString(),
      dataPreview: {
        date: dateKeyInTimezone(friend.timezone),
        habitCompletion: settings.habitLevel === 'none' ? null : 0,
        streakDays: settings.habitLevel === 'none' ? null : 0,
        toiletRecorded: settings.toiletLevel === 'none' ? null : false,
        trainingDone: settings.trainingLevel === 'none' ? null : false,
      },
      friend,
      friendshipId: row.id,
      latestEvent: thread[0] ? projectMockEvent(thread[0], row, currentUser.id) : null,
      pendingCount: thread.filter(
        (event) =>
          event.kind === 'manual_nudge' &&
          event.toUser.id === currentUser.id &&
          !event.ack &&
          new Date(event.expiresAt).getTime() > Date.now(),
      ).length,
    };
  }

  async function getFriend(currentUser: CurrentUser, friendUserId: string): Promise<FriendResponse> {
    const row = requireMockFriendship(currentUser.id, friendUserId);
    const friend = row.users.find((user) => user.id === friendUserId)!;
    const mySettings = row.settings.get(currentUser.id) ?? {
      ...defaultFriendSettings,
      allowEnabledAt: null,
      notifyEnabledAt: null,
    };
    const friendOwnedSettings = row.settings.get(friendUserId) ?? {
      ...defaultFriendSettings,
      allowEnabledAt: null,
      notifyEnabledAt: null,
    };
    return {
      friend: {
        ...mockSummary(row, currentUser),
        friend,
        friendSettings: publicMockSettings(friendOwnedSettings),
        mySettings: publicMockSettings(mySettings),
        toiletNotificationsActive:
          mySettings.notifyFriendOnToiletEnd && friendOwnedSettings.allowToiletEndNotificationsFromFriend,
      },
    };
  }

  return {
    async acceptInvite(currentUser, token) {
      const invite = invites.get(token);
      if (!invite) throw new ApiError(404, 'not_found', '没有找到这个好友邀请。');
      ensureInviteUsable({ ...invite, revokedAt: null });
      if (invite.inviter.id === currentUser.id) throw new ApiError(400, 'bad_request', '不能接受自己的好友邀请。');
      if (findMockFriendship(invite.inviter.id, currentUser.id))
        throw new ApiError(409, 'conflict', '你们已经是好友了。');
      const counts = [invite.inviter.id, currentUser.id].map(
        (userId) => [...friendshipRows.values()].filter((row) => row.users.some((user) => user.id === userId)).length,
      );
      if (counts.some((count) => count >= friendLimit)) {
        throw new ApiError(409, 'conflict', '好友数量已经达到 20 人上限。');
      }
      invite.acceptedAt = new Date();
      const id = randomUUID();
      friendshipRows.set(id, {
        createdAt: new Date(),
        id,
        settings: new Map([
          [invite.inviter.id, { ...defaultFriendSettings, allowEnabledAt: null, notifyEnabledAt: null }],
          [currentUser.id, { ...defaultFriendSettings, allowEnabledAt: null, notifyEnabledAt: null }],
        ]),
        toiletEventSourceIds: new Set(),
        users: [invite.inviter, currentUser],
      });
      return getFriend(currentUser, invite.inviter.id);
    },
    async ackNudge(currentUser, eventId, status) {
      const event = [...events.values()].flat().find((item) => item.id === eventId);
      if (!event || event.kind !== 'manual_nudge') throw new ApiError(404, 'not_found', '没有找到这条好友提醒。');
      if (event.toUser.id !== currentUser.id) throw new ApiError(403, 'forbidden', '只能回复发给自己的提醒。');
      if (new Date(event.expiresAt).getTime() <= Date.now()) {
        throw new ApiError(409, 'conflict', '这条好友提醒已经过期。');
      }
      const now = new Date().toISOString();
      if (event.ack?.status === status) return { ack: event.ack };
      if (
        event.ack &&
        (event.ack.revisionCount >= 1 || new Date(event.ack.createdAt).getTime() <= Date.now() - ackRevisionWindowMs)
      ) {
        throw new ApiError(409, 'conflict', '这条回执已经不能修改了。');
      }
      event.ack = {
        createdAt: event.ack?.createdAt ?? now,
        revisionCount: event.ack ? 1 : 0,
        status,
        updatedAt: now,
      };
      await notifySafely(pushNotificationService, {
        body: ackNotificationMessages[status],
        data: { eventId, friendUserId: currentUser.id, kind: 'friend-nudge-ack', status },
        title: '好友有回音了',
        userId: event.fromUser.id,
      });
      return { ack: event.ack };
    },
    async createInvite(currentUser) {
      const count = [...friendshipRows.values()].filter((row) =>
        row.users.some((user) => user.id === currentUser.id),
      ).length;
      if (count >= friendLimit) throw new ApiError(409, 'conflict', '好友数量已经达到 20 人上限。');
      const token = createInviteToken();
      const invite = {
        acceptedAt: null,
        expiresAt: new Date(Date.now() + inviteTtlMs),
        id: randomUUID(),
        inviter: currentUser,
      };
      invites.set(token, invite);
      return {
        expiresAt: invite.expiresAt.toISOString(),
        inviteId: invite.id,
        inviteUrl: createInviteUrl(token),
        token,
      };
    },
    async deleteFriend(currentUser, friendUserId) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      friendshipRows.delete(row.id);
      events.delete(row.id);
      for (const key of nudgeCounters.keys()) {
        if (
          key.startsWith(`${currentUser.id}:${friendUserId}:`) ||
          key.startsWith(`${friendUserId}:${currentUser.id}:`)
        ) {
          nudgeCounters.delete(key);
        }
      }
    },
    getFriend,
    async getFriendData(currentUser, friendUserId) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const friend = row.users.find((user) => user.id === friendUserId)!;
      const settings = row.settings.get(friendUserId) ?? {
        ...defaultFriendSettings,
        allowEnabledAt: null,
        notifyEnabledAt: null,
      };
      const dates = dateRange(dateKeyInTimezone(friend.timezone), settings.historyDays);
      return {
        days: dates.map((date) => projectDay(emptySummary(date), settings, 0)),
        friend,
        historyDays: settings.historyDays,
      };
    },
    async listEvents(currentUser, friendUserId, options) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const cursor = parseEventCursor(options.before);
      const all = (events.get(row.id) ?? []).filter((event) => {
        if (!cursor) return true;
        const occurredAt = new Date(event.occurredAt);
        return (
          occurredAt < cursor.occurredAt ||
          (occurredAt.getTime() === cursor.occurredAt.getTime() && event.id < cursor.id)
        );
      });
      const page = all.slice(0, options.limit);
      return {
        events: page.map((event) => projectMockEvent(event, row, currentUser.id)),
        hasMore: all.length > options.limit,
        nextCursor:
          all.length > options.limit && page.at(-1)
            ? Buffer.from(`${page.at(-1)!.occurredAt}\n${page.at(-1)!.id}`).toString('base64url')
            : null,
      };
    },
    async listFriends(currentUser) {
      return {
        friends: [...friendshipRows.values()]
          .filter((row) => row.users.some((user) => user.id === currentUser.id))
          .map((row) => mockSummary(row, currentUser)),
      };
    },
    async previewInvite(token) {
      const invite = invites.get(token);
      if (!invite) throw new ApiError(404, 'not_found', '没有找到这个好友邀请。');
      ensureInviteUsable({ ...invite, revokedAt: null });
      return { expiresAt: invite.expiresAt.toISOString(), inviter: invite.inviter };
    },
    async recordToiletFinished(currentUser, event) {
      for (const row of friendshipRows.values()) {
        if (!row.users.some((user) => user.id === currentUser.id)) continue;
        const recipient = row.users.find((user) => user.id !== currentUser.id)!;
        const senderSettings = row.settings.get(currentUser.id)!;
        const recipientSettings = row.settings.get(recipient.id)!;
        const endedAt = new Date(event.endedAt);
        if (
          !senderSettings.notifyFriendOnToiletEnd ||
          !recipientSettings.allowToiletEndNotificationsFromFriend ||
          !senderSettings.notifyEnabledAt ||
          !recipientSettings.allowEnabledAt ||
          Number.isNaN(endedAt.getTime()) ||
          endedAt < senderSettings.notifyEnabledAt ||
          endedAt < recipientSettings.allowEnabledAt
        ) {
          continue;
        }
        const thread = events.get(row.id) ?? [];
        const sourceKey = `${currentUser.id}:${recipient.id}:${event.sourceEntityId}`;
        if (row.toiletEventSourceIds.has(sourceKey)) continue;
        row.toiletEventSourceIds.add(sourceKey);
        const created: FriendEvent = {
          createdAt: new Date().toISOString(),
          durationSeconds: event.durationSeconds,
          friendshipId: row.id,
          fromUser: currentUser,
          id: randomUUID(),
          kind: 'toilet_finished',
          occurredAt: event.endedAt,
          toUser: recipient,
        };
        events.set(row.id, [created, ...thread]);
        if (!isInQuietRanges(recipientSettings.quietRanges, recipient.timezone)) {
          const nickname = currentUser.nickname ?? '你的好友';
          await notifySafely(pushNotificationService, {
            body:
              senderSettings.toiletLevel === 'detailed'
                ? `${nickname}刚结束蹲会儿，本次 ${Math.max(1, Math.round(event.durationSeconds / 60))} 分钟。`
                : `${nickname}刚结束蹲会儿。`,
            data: { eventId: created.id, friendUserId: currentUser.id, kind: 'friend-toilet-finished' },
            title: '好友刚收工',
            userId: recipient.id,
          });
        }
      }
    },
    async sendNudge(currentUser, friendUserId, input) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const friend = row.users.find((user) => user.id === friendUserId)!;
      const recipientSettings = row.settings.get(friendUserId)!;
      if (!recipientSettings.nudgesEnabled || recipientSettings.nudgeDailyLimit === 0) {
        throw new ApiError(403, 'forbidden', '这个好友暂时关闭了主动提醒。');
      }
      if (isInQuietRanges(recipientSettings.quietRanges, friend.timezone)) {
        throw new ApiError(403, 'forbidden', '现在是好友的免打扰时间。');
      }
      const now = new Date();
      const counterKey = `${currentUser.id}:${friendUserId}:${dateKeyInTimezone(friend.timezone, now)}`;
      const count = (nudgeCounters.get(counterKey) ?? 0) + 1;
      if (count > recipientSettings.nudgeDailyLimit) {
        throw new ApiError(429, 'rate_limited', '今天已经轻轻戳够了，明天再来。');
      }
      nudgeCounters.set(counterKey, count);
      const created: FriendEvent = {
        ack: null,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + nudgeTtlMs).toISOString(),
        friendshipId: row.id,
        fromUser: currentUser,
        id: randomUUID(),
        kind: 'manual_nudge',
        message: nudgeMessages[input.type],
        nudgeType: input.type,
        occurredAt: now.toISOString(),
        toUser: friend,
      };
      events.set(row.id, [created, ...(events.get(row.id) ?? [])]);
      await notifySafely(pushNotificationService, {
        body: created.message,
        data: { eventId: created.id, friendUserId: currentUser.id, kind: 'friend-nudge', type: input.type },
        title: '好友轻轻戳了你一下',
        userId: friendUserId,
      });
      return created;
    },
    async updateSettings(currentUser, friendUserId, input) {
      const row = requireMockFriendship(currentUser.id, friendUserId);
      const current = row.settings.get(currentUser.id)!;
      const now = new Date();
      row.settings.set(currentUser.id, {
        ...current,
        ...input,
        allowEnabledAt:
          input.allowToiletEndNotificationsFromFriend === undefined
            ? current.allowEnabledAt
            : input.allowToiletEndNotificationsFromFriend
              ? (current.allowEnabledAt ?? now)
              : null,
        notifyEnabledAt:
          input.notifyFriendOnToiletEnd === undefined
            ? current.notifyEnabledAt
            : input.notifyFriendOnToiletEnd
              ? (current.notifyEnabledAt ?? now)
              : null,
      });
      return getFriend(currentUser, friendUserId);
    },
  };
}

function publicMockSettings(
  settings: FriendSettings & { allowEnabledAt: Date | null; notifyEnabledAt: Date | null },
): FriendSettings {
  const { allowEnabledAt: _allowEnabledAt, notifyEnabledAt: _notifyEnabledAt, ...publicValues } = settings;
  return publicValues;
}

function projectMockEvent(event: FriendEvent, row: MockFriendship, requesterId: string): FriendEvent {
  if (event.kind !== 'toilet_finished') return event;
  const ownerSettings = row.settings.get(event.fromUser.id);
  return {
    ...event,
    durationSeconds:
      requesterId === event.fromUser.id || ownerSettings?.toiletLevel === 'detailed' ? event.durationSeconds : null,
  };
}
