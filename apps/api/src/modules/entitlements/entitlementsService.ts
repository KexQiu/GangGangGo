import { and, desc, eq, isNull } from 'drizzle-orm';

import type { EntitlementsResponse, ProStatus, SubscriptionStatus } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { subscriptions } from '../../db/schema.js';
import type { CurrentUser } from '../users/userTypes.js';

export type EntitlementsService = {
  getEntitlements: (user: CurrentUser) => Promise<EntitlementsResponse>;
};

export function createMockEntitlementsService(): EntitlementsService {
  return {
    async getEntitlements() {
      return {
        proStatus: 'free',
      };
    },
  };
}

export type EntitlementSubscriptionState = {
  expiresAt: Date | null;
  status: SubscriptionStatus;
};

export function resolveProStatus(subscription: EntitlementSubscriptionState | null, now = new Date()): ProStatus {
  if (!subscription) {
    return 'free';
  }

  if (subscription.status === 'revoked') {
    return 'pro_expired';
  }

  if (subscription.expiresAt && subscription.expiresAt <= now) {
    return 'pro_expired';
  }

  if (subscription.status === 'active') {
    return 'pro_active';
  }

  if (subscription.status === 'grace_period') {
    return 'pro_grace_period';
  }

  return 'pro_expired';
}

export function createDrizzleEntitlementsService(db: Database): EntitlementsService {
  return {
    async getEntitlements(user) {
      const [subscription] = await db
        .select({
          expiresAt: subscriptions.expiresAt,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, user.id), isNull(subscriptions.revokedAt)))
        .orderBy(desc(subscriptions.updatedAt))
        .limit(1);

      return {
        proStatus: resolveProStatus(subscription),
      };
    },
  };
}
