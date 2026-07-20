import { type WatchEvent, type WatchEventAck } from './watchTypes';

export function extractWatchEvent(payload: unknown): WatchEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const maybeWrapped = payload as { event?: unknown; type?: unknown };
  const candidate = maybeWrapped.type === 'watch_event' ? maybeWrapped.event : payload;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const event = candidate as Partial<WatchEvent>;

  if (typeof event.id !== 'string' || typeof event.type !== 'string' || typeof event.createdAt !== 'string') {
    return null;
  }
  if (event.schemaVersion !== undefined && event.schemaVersion !== 2) {
    return null;
  }
  if (event.type !== 'training_completed' && event.type !== 'habit_toggled' && event.type !== 'toilet_timer_action') {
    return null;
  }

  return event as WatchEvent;
}

export function createInvalidWatchPayloadAck(): WatchEventAck {
  return {
    eventId: 'unknown',
    message: '手表消息格式不对。',
    status: 'rejected',
  };
}
