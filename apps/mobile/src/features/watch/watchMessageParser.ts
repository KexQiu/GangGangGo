import { type WatchEvent, type WatchEventAck } from './watchTypes';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): value is ObjectValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}
function integer(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

export function extractWatchEvent(payload: unknown): WatchEvent | null {
  if (!object(payload) || payload.type !== 'watch_event' || !object(payload.event)) return null;
  const event = payload.event;
  if (
    !id(event.id) ||
    typeof event.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(event.createdAt)) ||
    event.schemaVersion !== 3
  )
    return null;
  if (!object(event.owner) || !id(event.owner.userId) || !id(event.owner.profileId) || !object(event.payload))
    return null;
  const base = {
    id: event.id,
    createdAt: event.createdAt,
    schemaVersion: 3 as const,
    owner: { userId: event.owner.userId, profileId: event.owner.profileId },
  };
  const data = event.payload;
  if (
    event.type === 'training_completed' &&
    (data.mode === 'beginner' || data.mode === 'standard' || data.mode === 'quick') &&
    integer(data.completedSets, 1000) &&
    integer(data.durationSeconds, 86400)
  ) {
    return {
      ...base,
      type: event.type,
      payload: { mode: data.mode, completedSets: data.completedSets, durationSeconds: data.durationSeconds },
    };
  }
  if (
    event.type === 'habit_toggled' &&
    (data.habitKey === 'water' ||
      data.habitKey === 'fiber' ||
      data.habitKey === 'movement' ||
      data.habitKey === 'bowel') &&
    (data.level === undefined ||
      data.level === null ||
      data.level === 'low' ||
      data.level === 'medium' ||
      data.level === 'good')
  ) {
    // Swift Codable 省略 nil；WCSession 的 property list 不接受 NSNull。
    return { ...base, type: event.type, payload: { habitKey: data.habitKey, level: data.level ?? null } };
  }
  if (
    event.type === 'toilet_timer_action' &&
    (data.action === 'finish' || data.action === 'pause' || data.action === 'resume') &&
    id(data.sessionId) &&
    integer(data.elapsedSeconds, 86400)
  ) {
    return {
      ...base,
      type: event.type,
      payload: { action: data.action, elapsedSeconds: data.elapsedSeconds, sessionId: data.sessionId },
    };
  }
  return null;
}

export function createInvalidWatchPayloadAck(payload?: unknown): WatchEventAck {
  const eventId = object(payload) && object(payload.event) && id(payload.event.id) ? payload.event.id : 'unknown';
  return { eventId, message: '手表消息格式不对，请同步手机和手表版本。', status: 'rejected' };
}
