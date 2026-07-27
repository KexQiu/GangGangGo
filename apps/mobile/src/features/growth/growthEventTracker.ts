import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { GrowthEventName, GrowthEventProperties } from '@xiaotidu/contracts';

import { growthEventsApi } from '../../api/client';
import { useAuthStore } from '../account/authStore';
import { initializeDatabase } from '../../storage/db';

const installationMetadataKey = 'analytics_installation_id';
const activationMetadataKey = 'analytics_activation_completed';
const retentionWindowMs = 90 * 24 * 60 * 60 * 1000;
const batchSize = 50;

type GrowthEventOutboxRow = {
  app_version: string;
  event_id: string;
  event_name: GrowthEventName;
  installation_id: string;
  occurred_at: string;
  platform: 'android' | 'ios';
  properties_json: string;
  sequence: number;
};

let flushPromise: Promise<void> | null = null;

export function trackGrowthEvent(name: GrowthEventName, properties: GrowthEventProperties = {}) {
  void enqueueAndFlush(name, properties);
}

export function trackActivationCompleted() {
  void enqueueActivationOnce();
}

export function flushGrowthEvents() {
  flushPromise ??= flushPendingEvents().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function enqueueAndFlush(name: GrowthEventName, properties: GrowthEventProperties) {
  try {
    const db = await initializeDatabase();
    const installationId = await getInstallationId(db);
    const occurredAt = new Date().toISOString();
    await db.runAsync(
      `
        INSERT OR IGNORE INTO growth_event_outbox (
          event_id, installation_id, event_name, occurred_at, platform, app_version, properties_json
        ) VALUES ($eventId, $installationId, $eventName, $occurredAt, $platform, $appVersion, $propertiesJson);
      `,
      {
        $appVersion: Constants.expoConfig?.version ?? '0.2.0',
        $eventId: createEventId(),
        $eventName: name,
        $installationId: installationId,
        $occurredAt: occurredAt,
        $platform: nativePlatform(),
        $propertiesJson: JSON.stringify(properties),
      },
    );
    await cleanupExpiredEvents(db);
    await flushGrowthEvents();
  } catch {
    // 埋点链路不能阻塞记录、同步或登录等核心流程。
  }
}

async function enqueueActivationOnce() {
  try {
    const db = await initializeDatabase();
    const existing = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = $key;', {
      $key: activationMetadataKey,
    });
    if (existing) return;

    const installationId = await getInstallationId(db);
    const occurredAt = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `
          INSERT OR IGNORE INTO growth_event_outbox (
            event_id, installation_id, event_name, occurred_at, platform, app_version, properties_json
          ) VALUES ($eventId, $installationId, 'activation_completed', $occurredAt, $platform, $appVersion, '{}');
        `,
        {
          $appVersion: Constants.expoConfig?.version ?? '0.2.0',
          $eventId: `evt-activation-${installationId.slice(0, 60)}`,
          $installationId: installationId,
          $occurredAt: occurredAt,
          $platform: nativePlatform(),
        },
      );
      await db.runAsync('INSERT OR IGNORE INTO app_metadata (key, value) VALUES ($key, $value);', {
        $key: activationMetadataKey,
        $value: occurredAt,
      });
    });
    await flushGrowthEvents();
  } catch {
    // 激活埋点失败时保留核心行为，不打断用户操作。
  }
}

async function flushPendingEvents() {
  try {
    const db = await initializeDatabase();
    await cleanupExpiredEvents(db);
    for (let batchIndex = 0; batchIndex < 10; batchIndex += 1) {
      const rows = await db.getAllAsync<GrowthEventOutboxRow>(
        `
          SELECT sequence, event_id, installation_id, event_name, occurred_at, platform, app_version, properties_json
          FROM growth_event_outbox
          ORDER BY sequence
          LIMIT $limit;
        `,
        { $limit: batchSize },
      );
      if (rows.length === 0) return;

      const events = rows.map((row) => ({
        appVersion: row.app_version,
        eventId: row.event_id,
        installationId: row.installation_id,
        name: row.event_name,
        occurredAt: row.occurred_at,
        platform: row.platform,
        properties: parseProperties(row.properties_json),
      }));
      const token = useAuthStore.getState().accessToken;
      if (token) await growthEventsApi.submitAuthenticated({ events }, token);
      else await growthEventsApi.submitAnonymous({ events });

      const placeholders = rows.map((_, index) => `$eventId${index}`).join(', ');
      await db.runAsync(
        `DELETE FROM growth_event_outbox WHERE event_id IN (${placeholders});`,
        Object.fromEntries(rows.map((row, index) => [`$eventId${index}`, row.event_id])),
      );
      if (rows.length < batchSize) return;
    }
  } catch {
    // 保留 outbox，等待下一次启动、登录或回到前台时重试。
  }
}

async function getInstallationId(db: Awaited<ReturnType<typeof initializeDatabase>>) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_metadata WHERE key = $key;', {
    $key: installationMetadataKey,
  });
  if (row?.value && /^[a-zA-Z0-9_-]{16,80}$/.test(row.value)) return row.value;

  const installationId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
  await db.runAsync(
    `
      INSERT INTO app_metadata (key, value) VALUES ($key, $value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `,
    { $key: installationMetadataKey, $value: installationId },
  );
  return installationId;
}

async function cleanupExpiredEvents(db: Awaited<ReturnType<typeof initializeDatabase>>) {
  await db.runAsync('DELETE FROM growth_event_outbox WHERE occurred_at < $cutoff;', {
    $cutoff: new Date(Date.now() - retentionWindowMs).toISOString(),
  });
}

function parseProperties(value: string): GrowthEventProperties {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as GrowthEventProperties;
  } catch {
    return {};
  }
}

function createEventId() {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

function nativePlatform(): 'android' | 'ios' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}
