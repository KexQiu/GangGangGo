import { and, eq } from 'drizzle-orm';

import type {
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { pushTokens } from '../../db/schema.js';
import type { CurrentUser } from '../users/userTypes.js';

export type PushTokenService = {
  registerToken: (
    currentUser: CurrentUser,
    input: RegisterPushTokenRequest,
  ) => Promise<RegisterPushTokenResponse>;
};

export function createMockPushTokenService(): PushTokenService {
  const tokens = new Map<string, RegisterPushTokenResponse>();

  return {
    async registerToken(_currentUser, input) {
      const key = `${input.provider}:${input.token}`;
      const existingToken = tokens.get(key);

      if (existingToken) {
        return existingToken;
      }

      const response = {
        id: `mock-push-token-${tokens.size + 1}`,
      };

      tokens.set(key, response);

      return response;
    },
  };
}

export function createDrizzlePushTokenService(db: Database): PushTokenService {
  return {
    async registerToken(currentUser, input) {
      const [existingToken] = await db
        .select()
        .from(pushTokens)
        .where(and(eq(pushTokens.provider, input.provider), eq(pushTokens.token, input.token)))
        .limit(1);

      if (existingToken) {
        const [updatedToken] = await db
          .update(pushTokens)
          .set({
            deviceId: input.deviceId,
            enabled: true,
            lastSeenAt: new Date(),
            platform: input.platform,
            updatedAt: new Date(),
            userId: currentUser.id,
          })
          .where(eq(pushTokens.id, existingToken.id))
          .returning();

        return {
          id: updatedToken?.id ?? existingToken.id,
        };
      }

      const [createdToken] = await db
        .insert(pushTokens)
        .values({
          deviceId: input.deviceId,
          platform: input.platform,
          provider: input.provider,
          token: input.token,
          userId: currentUser.id,
        })
        .returning();

      if (!createdToken) {
        throw new Error('Failed to register push token.');
      }

      return {
        id: createdToken.id,
      };
    },
  };
}
