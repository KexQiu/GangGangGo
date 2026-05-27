import { buildWatchTodayState } from './watchStateBuilder';
import { addWatchConnectivityEventListener, replyToWatchMessage, sendWatchTodayState } from './watchConnectivity';
import { handleWatchEvent } from './watchEventHandler';
import { type WatchEvent, type WatchSyncResult, type WatchTodayState } from './watchTypes';

let eventListenerStarted = false;

export async function syncWatchTodayState(now = new Date()): Promise<WatchSyncResult> {
  const state = buildWatchTodayState(now);

  return sendWatchTodayState(state);
}

export function getCurrentWatchTodayState(now = new Date()): WatchTodayState {
  return buildWatchTodayState(now);
}

export function startWatchConnectivityEventListener() {
  if (eventListenerStarted) {
    return;
  }

  const subscription = addWatchConnectivityEventListener((payload) => {
    void handleIncomingWatchPayload(payload);
  });

  eventListenerStarted = Boolean(subscription);
}

async function handleIncomingWatchPayload(payload: unknown) {
  const replyId = extractReplyId(payload);

  if (isWatchStateRequest(payload)) {
    const state = getCurrentWatchTodayState();
    const stateJson = JSON.stringify(state);
    await sendWatchTodayState(state);
    await replyToWatchMessage(replyId, {
      eventId: 'request_today_state',
      state,
      stateJson,
      status: 'accepted',
    });
    return;
  }

  const event = extractWatchEvent(payload);

  if (!event) {
    await replyToWatchMessage(replyId, {
      eventId: 'unknown',
      message: '手表消息格式不对。',
      status: 'rejected',
    });
    return;
  }

  const ack = await handleWatchEvent(event);
  const state = getCurrentWatchTodayState();
  const stateJson = JSON.stringify(state);
  await replyToWatchMessage(replyId, {
    ...ack,
    state,
    stateJson,
  });
  await sendWatchTodayState(state);
}

function extractWatchEvent(payload: unknown): WatchEvent | null {
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

  if (event.type !== 'training_completed' && event.type !== 'habit_toggled' && event.type !== 'toilet_timer_action') {
    return null;
  }

  return event as WatchEvent;
}

function isWatchStateRequest(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return (payload as { type?: unknown }).type === 'request_today_state';
}

function extractReplyId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const replyId = (payload as { replyId?: unknown }).replyId;

  return typeof replyId === 'string' ? replyId : undefined;
}
