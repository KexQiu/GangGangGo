import { describe, expect, it, vi } from 'vitest';

import type { PushNotificationService } from '../push/pushNotificationService.js';
import type { CurrentUser } from '../users/userTypes.js';
import { createMockFriendService, defaultFriendSettings } from './friendService.js';

const userA = createUser('00000000-0000-4000-8000-000000000001', '甲');
const userB = createUser('00000000-0000-4000-8000-000000000002', '乙');

describe('friend service', () => {
  it('creates a mutual friendship with private defaults and a single-use invite', async () => {
    const service = createMockFriendService();
    const invite = await service.createInvite(userA);

    await expect(service.previewInvite(invite.token)).resolves.toMatchObject({ inviter: { id: userA.id } });
    const accepted = await service.acceptInvite(userB, invite.token);
    expect(accepted.friend.mySettings).toEqual(defaultFriendSettings);
    expect(accepted.friend.friendSettings).toEqual(defaultFriendSettings);
    expect(accepted.friend.toiletNotificationsActive).toBe(false);
    await expect(
      service.acceptInvite(createUser('00000000-0000-4000-8000-000000000003', '丙'), invite.token),
    ).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(service.listFriends(userA)).resolves.toMatchObject({ friends: [{ friend: { id: userB.id } }] });
  });

  it('requires bilateral switches, avoids backfill and emits each toilet record once', async () => {
    const sendToUser = vi.fn<PushNotificationService['sendToUser']>().mockResolvedValue(undefined);
    const service = createMockFriendService({ pushNotificationService: { sendToUser } });
    const invite = await service.createInvite(userA);
    await service.acceptInvite(userB, invite.token);

    await service.updateSettings(userA, userB.id, { notifyFriendOnToiletEnd: true, toiletLevel: 'detailed' });
    await service.recordToiletFinished(userA, {
      durationSeconds: 600,
      endedAt: '2026-01-01T00:00:00.000Z',
      sourceEntityId: 'old-record',
    });
    expect((await service.listEvents(userB, userA.id, { limit: 30 })).events).toEqual([]);

    await service.updateSettings(userB, userA.id, { allowToiletEndNotificationsFromFriend: true });
    const endedAt = new Date(Date.now() + 1_000).toISOString();
    const event = { durationSeconds: 600, endedAt, sourceEntityId: 'new-record' };
    await service.recordToiletFinished(userA, event);
    await service.recordToiletFinished(userA, event);

    const timeline = await service.listEvents(userB, userA.id, { limit: 30 });
    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0]).toMatchObject({ durationSeconds: 600, kind: 'toilet_finished' });
    expect(sendToUser).toHaveBeenCalledTimes(1);
    expect(sendToUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'friend-toilet-finished' }), userId: userB.id }),
    );
  });

  it('applies data permissions in one direction and honors the selected history window', async () => {
    const service = createMockFriendService();
    const invite = await service.createInvite(userA);
    await service.acceptInvite(userB, invite.token);

    const privateData = await service.getFriendData(userB, userA.id);
    expect(privateData.days).toHaveLength(1);
    expect(privateData.days[0]).toMatchObject({
      habit: { level: 'none' },
      toilet: { level: 'none' },
      training: { level: 'none' },
    });

    await service.updateSettings(userA, userB.id, { historyDays: 7, trainingLevel: 'summary' });
    const grantedData = await service.getFriendData(userB, userA.id);
    expect(grantedData.days).toHaveLength(7);
    expect(grantedData.days.every((day) => day.training.level === 'summary')).toBe(true);
    expect((await service.getFriendData(userA, userB.id)).days[0]?.training.level).toBe('none');
  });

  it('keeps a toilet event in the timeline while quiet hours suppress push', async () => {
    const sendToUser = vi.fn<PushNotificationService['sendToUser']>().mockResolvedValue(undefined);
    const service = createMockFriendService({ pushNotificationService: { sendToUser } });
    const invite = await service.createInvite(userA);
    await service.acceptInvite(userB, invite.token);
    await service.updateSettings(userA, userB.id, { notifyFriendOnToiletEnd: true });
    await service.updateSettings(userB, userA.id, {
      allowToiletEndNotificationsFromFriend: true,
      quietRanges: [{ end: '00:00', start: '00:00' }],
    });

    await service.recordToiletFinished(userA, {
      durationSeconds: 300,
      endedAt: new Date(Date.now() + 1_000).toISOString(),
      sourceEntityId: 'quiet-record',
    });

    expect((await service.listEvents(userB, userA.id, { limit: 30 })).events).toHaveLength(1);
    expect(sendToUser).not.toHaveBeenCalled();
  });

  it('enforces recipient reminder settings and deletes relationship history', async () => {
    const service = createMockFriendService();
    const invite = await service.createInvite(userA);
    await service.acceptInvite(userB, invite.token);
    await service.updateSettings(userB, userA.id, { nudgesEnabled: false });
    await expect(service.sendNudge(userA, userB.id, { type: 'move' })).rejects.toMatchObject({ code: 'forbidden' });

    await service.updateSettings(userB, userA.id, { nudgeDailyLimit: 3, nudgesEnabled: true });
    const event = await service.sendNudge(userA, userB.id, { type: 'move' });
    await expect(service.ackNudge(userB, event.id, 'received')).resolves.toMatchObject({
      ack: { status: 'received' },
    });
    await service.sendNudge(userA, userB.id, { type: 'gentle' });
    await service.sendNudge(userA, userB.id, { type: 'posture' });
    await expect(service.sendNudge(userA, userB.id, { type: 'habit_left' })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    await service.deleteFriend(userA, userB.id);
    await expect(service.listEvents(userB, userA.id, { limit: 30 })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('caps every user at twenty friends from either side of an invite', async () => {
    const service = createMockFriendService();
    for (let index = 2; index <= 21; index += 1) {
      const invite = await service.createInvite(userA);
      await service.acceptInvite(createUser(uuid(index), `好友 ${index}`), invite.token);
    }

    await expect(service.createInvite(userA)).rejects.toMatchObject({ code: 'conflict' });
    const extraUser = createUser(uuid(22), '额外好友');
    const invite = await service.createInvite(extraUser);
    await expect(service.acceptInvite(userA, invite.token)).rejects.toMatchObject({ code: 'conflict' });
  });
});

function createUser(id: string, nickname: string): CurrentUser {
  return { appleUserId: `apple-${nickname}`, avatarUrl: null, id, nickname, timezone: 'Asia/Shanghai' };
}

function uuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
}
