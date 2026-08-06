import { and, count, eq, gte, isNull } from 'drizzle-orm';

import type { GrowthEventsRequest, GrowthEventsResponse } from '@xiaotidu/contracts';

import type { Database } from '../../db/client.js';
import { growthEvents } from '../../db/schema.js';
import { ApiError } from '../../http/apiError.js';

const dailyEventLimit = 500;
const anonymousAssociationWindowMs = 90 * 24 * 60 * 60 * 1000;

export type GrowthEventService = {
  recordBatch: (input: GrowthEventsRequest, userId?: string) => Promise<GrowthEventsResponse>;
};

export function createMockGrowthEventService(): GrowthEventService {
  const eventIds = new Set<string>();

  return {
    async recordBatch(input) {
      let accepted = 0;
      for (const event of input.events) {
        if (eventIds.has(event.eventId)) continue;
        eventIds.add(event.eventId);
        accepted += 1;
      }
      return { accepted };
    },
  };
}

export function createDrizzleGrowthEventService(db: Database): GrowthEventService {
  return {
    async recordBatch(input, userId) {
      const installationIds = [...new Set(input.events.map((event) => event.installationId))];
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);

      for (const installationId of installationIds) {
        const [usage] = await db
          .select({ count: count() })
          .from(growthEvents)
          .where(and(eq(growthEvents.installationId, installationId), gte(growthEvents.receivedAt, dayStart)));
        const used = Number(usage?.count ?? 0);
        const pending = input.events.filter((event) => event.installationId === installationId).length;

        if (used + pending > dailyEventLimit) {
          throw new ApiError(429, 'rate_limited', '增长事件上传过于频繁，请稍后再试。');
        }
      }

      if (userId) {
        const associationCutoff = new Date(Date.now() - anonymousAssociationWindowMs);
        for (const installationId of installationIds) {
          await db
            .update(growthEvents)
            .set({ userId })
            .where(
              and(
                eq(growthEvents.installationId, installationId),
                isNull(growthEvents.userId),
                gte(growthEvents.occurredAt, associationCutoff),
              ),
            );
        }
      }

      const inserted = await db
        .insert(growthEvents)
        .values(
          input.events.map((event) => ({
            appVersion: event.appVersion,
            eventId: event.eventId,
            eventName: event.name,
            installationId: event.installationId,
            occurredAt: new Date(event.occurredAt),
            platform: event.platform,
            properties: event.properties,
            userId: userId ?? null,
          })),
        )
        .onConflictDoNothing({ target: growthEvents.eventId })
        .returning({ id: growthEvents.id });

      return { accepted: inserted.length };
    },
  };
}
