import { and, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { pushTokens } from '../../db/schema.js';

export type PushNotificationPayload = {
  body: string;
  data?: Record<string, string>;
  title: string;
  userId: string;
};

export type PushNotificationService = {
  sendToUser: (payload: PushNotificationPayload) => Promise<void>;
};

type ExpoPushMessage = {
  body: string;
  data?: Record<string, string>;
  sound?: null | 'default';
  title: string;
  to: string;
};

type CreateExpoPushNotificationServiceOptions = {
  accessToken?: string;
  endpoint?: string;
};

type ExpoPushTicket = {
  details?: {
    error?: string;
  };
  id?: string;
  message?: string;
  status: 'error' | 'ok';
};

function isExpoPushResponse(input: unknown): input is { data: ExpoPushTicket[] } {
  return (
    typeof input === 'object' &&
    input !== null &&
    Array.isArray((input as { data?: unknown }).data)
  );
}

export function createNoopPushNotificationService(): PushNotificationService {
  return {
    async sendToUser() {},
  };
}

export function createExpoPushNotificationService(
  db: Database,
  options: CreateExpoPushNotificationServiceOptions = {},
): PushNotificationService {
  const endpoint = options.endpoint ?? 'https://exp.host/--/api/v2/push/send';

  return {
    async sendToUser(payload) {
      const tokens = await db
        .select({
          id: pushTokens.id,
          token: pushTokens.token,
        })
        .from(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, payload.userId),
            eq(pushTokens.enabled, true),
            eq(pushTokens.provider, 'expo'),
          ),
        );

      if (tokens.length === 0) {
        return;
      }

      const messages: ExpoPushMessage[] = tokens.map((token) => ({
        body: payload.body,
        data: payload.data,
        sound: 'default',
        title: payload.title,
        to: token.token,
      }));
      const response = await fetch(endpoint, {
        body: JSON.stringify(messages),
        headers: {
          accept: 'application/json',
          ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Expo push request failed with status ${response.status}.`);
      }

      const body: unknown = await response.json().catch(() => null);

      if (!isExpoPushResponse(body)) {
        return;
      }

      await Promise.all(
        body.data.map(async (ticket, index) => {
          const token = tokens[index];

          if (!token || ticket.status !== 'error' || ticket.details?.error !== 'DeviceNotRegistered') {
            return;
          }

          await db
            .update(pushTokens)
            .set({
              enabled: false,
              updatedAt: new Date(),
            })
            .where(eq(pushTokens.id, token.id));
        }),
      );
    },
  };
}
