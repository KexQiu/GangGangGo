import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { RegisterPushTokenRequest, RegisterPushTokenResponse } from '@xiaotidu/contracts';
import type { Database } from '../../db/client.js';
import { authSessions, pushTokens } from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';
import type { CurrentUser } from '../users/userTypes.js';

export type PushTokenService = {
  registerToken: (
    currentUser: CurrentUser,
    input: RegisterPushTokenRequest,
    sessionId: string,
  ) => Promise<RegisterPushTokenResponse>;
  revokeDevice: (currentUser: CurrentUser, deviceId: string, sessionId: string) => Promise<void>;
};

export function createMockPushTokenService(): PushTokenService {
  const tokens = new Map<string, RegisterPushTokenResponse & { userId: string; deviceId: string; sessionId: string }>();
  return {
    async registerToken(user, input, sessionId) {
      const key = `${input.provider}:${input.token}`;
      const binding = { id: tokens.get(key)?.id ?? randomUUID(), userId: user.id, deviceId: input.deviceId, sessionId };
      tokens.set(key, binding);
      return { id: binding.id };
    },
    async revokeDevice(user, deviceId, sessionId) {
      for (const [key, binding] of tokens)
        if (binding.userId === user.id && binding.deviceId === deviceId && binding.sessionId === sessionId)
          tokens.delete(key);
    },
  };
}

export function createDrizzlePushTokenService(db: Database): PushTokenService {
  return {
    async registerToken(user, input, sessionId) {
      return db.transaction(async (tx) => {
        const [family] = await tx
          .select({ id: authSessions.familyId })
          .from(authSessions)
          .where(eq(authSessions.id, sessionId));
        if (!family) throw new ApiError(401, 'unauthorized', '登录状态已失效。');
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'auth-family:' + family.id}, 0))`);
        const [session] = await tx
          .select()
          .from(authSessions)
          .where(
            and(
              eq(authSessions.id, sessionId),
              eq(authSessions.userId, user.id),
              isNull(authSessions.revokedAt),
              gt(authSessions.expiresAt, new Date()),
            ),
          );
        if (!session) throw new ApiError(401, 'unauthorized', '登录状态已失效。');
        await tx
          .update(pushTokens)
          .set({ enabled: false, updatedAt: new Date() })
          .where(and(eq(pushTokens.userId, user.id), eq(pushTokens.deviceId, input.deviceId)));
        const values = {
          ...input,
          userId: user.id,
          sessionId,
          enabled: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        };
        const [binding] = await tx
          .insert(pushTokens)
          .values(values)
          .onConflictDoUpdate({
            target: [pushTokens.provider, pushTokens.token],
            set: values,
          })
          .returning({ id: pushTokens.id });
        if (!binding) throw new Error('Failed to register push token.');
        return binding;
      });
    },
    async revokeDevice(user, deviceId, sessionId) {
      await db
        .update(pushTokens)
        .set({ enabled: false, updatedAt: new Date() })
        .where(
          and(eq(pushTokens.userId, user.id), eq(pushTokens.deviceId, deviceId), eq(pushTokens.sessionId, sessionId)),
        );
    },
  };
}
