import { and, desc, eq, isNull } from 'drizzle-orm';

import type {
  CommercialMode,
  EntitlementsResponse,
  FeatureAccess,
  ProStatus,
  SubscriptionStatus,
} from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { subscriptions } from '../../db/schema.js';
import type { CurrentUser } from '../users/userTypes.js';

export type EntitlementsService = {
  getEntitlements: (user: CurrentUser) => Promise<EntitlementsResponse>;
};

type EntitlementsServiceOptions = {
  commercialMode?: CommercialMode;
};

export function resolveFeatureAccess(commercialMode: CommercialMode, proStatus: ProStatus): FeatureAccess {
  const hasPaidAccess = proStatus === 'pro_active' || proStatus === 'pro_grace_period';
  const enabled = commercialMode === 'growth_free' || hasPaidAccess;

  return {
    advancedReport: enabled,
    reportSnapshotSync: enabled,
    watchActions: enabled,
  };
}

function toEntitlementsResponse(commercialMode: CommercialMode, proStatus: ProStatus): EntitlementsResponse {
  return {
    commercialMode,
    features: resolveFeatureAccess(commercialMode, proStatus),
    proStatus,
  };
}

export function createMockEntitlementsService(options: EntitlementsServiceOptions = {}): EntitlementsService {
  const commercialMode = options.commercialMode ?? 'growth_free';

  return {
    async getEntitlements() {
      return toEntitlementsResponse(commercialMode, 'free');
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

export function createDrizzleEntitlementsService(
  db: Database,
  options: EntitlementsServiceOptions = {},
): EntitlementsService {
  const commercialMode = options.commercialMode ?? 'growth_free';

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

      return toEntitlementsResponse(commercialMode, resolveProStatus(subscription));
    },
  };
}
