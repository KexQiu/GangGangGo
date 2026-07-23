import { describe, expect, it } from 'vitest';

import { createApiApp } from '../../app.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' });

describe('friend routes', () => {
  it.each([
    '/teams',
    '/team-invites/legacy',
    '/nudges',
    '/buddy-nudge-settings',
    '/share-settings',
    '/share-snapshots/today',
    '/teams/current/reports/weekly',
  ])('does not expose the retired social route %s', async (path) => {
    const app = createApiApp({ logger });
    expect((await app.request(path)).status).toBe(404);
  });

  it('supports invite confirmation, settings, sync events, reminders and hard deletion', async () => {
    const app = createApiApp({ logger });
    expect((await app.request('/friend-invites', { method: 'POST' })).status).toBe(401);
    const userA = await login(app, 'friend-a', '甲');
    const userB = await login(app, 'friend-b', '乙');

    const inviteResponse = await app.request('/friend-invites', {
      headers: authorization(userA.token),
      method: 'POST',
    });
    const inviteBody = await inviteResponse.json();
    expect(inviteResponse.status).toBe(200);
    expect(inviteBody.data.inviteUrl).toBe(`xiaotidu://friend/join/${inviteBody.data.token}`);

    const previewResponse = await app.request(`/friend-invites/${inviteBody.data.token}`);
    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({ data: { inviter: { id: userA.id } } });

    const acceptResponse = await app.request(`/friend-invites/${inviteBody.data.token}/accept`, {
      headers: authorization(userB.token),
      method: 'POST',
    });
    expect(acceptResponse.status).toBe(200);
    await expect(acceptResponse.json()).resolves.toMatchObject({
      data: {
        friend: {
          friend: { id: userA.id },
          mySettings: { habitLevel: 'none', toiletLevel: 'none', trainingLevel: 'none' },
        },
      },
    });

    await patchSettings(app, userA.token, userB.id, {
      notifyFriendOnToiletEnd: true,
      toiletLevel: 'detailed',
    });
    await patchSettings(app, userB.token, userA.id, { allowToiletEndNotificationsFromFriend: true });

    const endedAt = new Date(Date.now() + 1_000);
    const syncResponse = await app.request('/data-sync/push', {
      body: JSON.stringify({
        mutations: [
          {
            changedAt: new Date().toISOString(),
            entityId: 'route-toilet-record',
            entityType: 'toilet_session',
            mutationId: 'route-toilet-mutation',
            operation: 'upsert',
            payload: {
              bleeding: false,
              discomfort: false,
              durationSeconds: 360,
              endedAt: endedAt.toISOString(),
              feeling: 'normal',
              localDate: dateKey(endedAt),
              signals: [],
              startedAt: new Date(endedAt.getTime() - 360_000).toISOString(),
              stoolColor: null,
              stoolShape: null,
            },
          },
        ],
        timeZone: 'Asia/Shanghai',
      }),
      headers: jsonAuthorization(userA.token),
      method: 'PUT',
    });
    expect(syncResponse.status).toBe(200);

    const nudgeResponse = await app.request(`/friends/${userB.id}/nudges`, {
      body: JSON.stringify({ type: 'move' }),
      headers: jsonAuthorization(userA.token),
      method: 'POST',
    });
    expect(nudgeResponse.status).toBe(200);
    const nudgeBody = await nudgeResponse.json();

    const eventsResponse = await app.request(`/friends/${userA.id}/events`, {
      headers: authorization(userB.token),
    });
    const eventsBody = await eventsResponse.json();
    expect(eventsResponse.status).toBe(200);
    expect(eventsBody.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ durationSeconds: 360, kind: 'toilet_finished' }),
        expect.objectContaining({ id: nudgeBody.data.id, kind: 'manual_nudge' }),
      ]),
    );

    const ackResponse = await app.request(`/friend-events/${nudgeBody.data.id}/ack`, {
      body: JSON.stringify({ status: 'received' }),
      headers: jsonAuthorization(userB.token),
      method: 'POST',
    });
    expect(ackResponse.status).toBe(200);

    const deleteResponse = await app.request(`/friends/${userB.id}`, {
      headers: authorization(userA.token),
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(200);
    const listResponse = await app.request('/friends', { headers: authorization(userB.token) });
    await expect(listResponse.json()).resolves.toEqual({ data: { friends: [] } });
  });
});

async function login(app: ReturnType<typeof createApiApp>, identityToken: string, nickname: string) {
  const response = await app.request('/auth/apple', {
    body: JSON.stringify({ identityToken, nickname }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const body = await response.json();
  return { id: body.data.user.id as string, token: body.data.session.accessToken as string };
}

async function patchSettings(
  app: ReturnType<typeof createApiApp>,
  token: string,
  friendUserId: string,
  body: Record<string, unknown>,
) {
  const response = await app.request(`/friends/${friendUserId}/settings`, {
    body: JSON.stringify(body),
    headers: jsonAuthorization(token),
    method: 'PATCH',
  });
  expect(response.status).toBe(200);
}

function authorization(token: string) {
  return { authorization: `Bearer ${token}` };
}

function jsonAuthorization(token: string) {
  return { ...authorization(token), 'content-type': 'application/json' };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
