import { trainingSessionSyncPayloadSchema } from '@xiaotidu/contracts';
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
    event.schemaVersion !== 4
  )
    return null;
  if (!object(event.owner) || !id(event.owner.userId) || !id(event.owner.profileId) || !object(event.payload))
    return null;
  const base = {
    id: event.id,
    createdAt: event.createdAt,
    schemaVersion: 4 as const,
    owner: { userId: event.owner.userId, profileId: event.owner.profileId },
  };
  const data = event.payload;
  if (event.type === 'training_finished' && object(data.session) && id(data.session.id)) {
    const { id: sessionId, ...record } = data.session;
    const result = trainingSessionSyncPayloadSchema.safeParse({ ...record, localDate: '2000-01-01' });
    if (
      !result.success ||
      sessionId !== event.id ||
      !sessionId.startsWith('watch-') ||
      result.data.isCompleted !== (result.data.completedRepetitions === result.data.plan.repetitions)
    )
      return null;
    const { localDate: _localDate, ...session } = result.data;
    return { ...base, type: 'training_finished', payload: { session: { id: sessionId, ...session } } };
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
