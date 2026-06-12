import { buildWatchTodayState } from './watchStateBuilder';
import { useAuthStore } from '../account/authStore';
import { addWatchConnectivityEventListener, replyToWatchMessage, sendWatchTodayState } from './watchConnectivity';
import { useWatchDebugStore } from './watchDebugStore';
import { handleWatchEvent } from './watchEventHandler';
import { type WatchEvent, type WatchSyncResult, type WatchTodayState } from './watchTypes';

let eventListenerStarted = false;

export async function syncWatchTodayState(now = new Date(), source = 'auto'): Promise<WatchSyncResult> {
  const state = buildWatchTodayState(now);
  useWatchDebugStore.getState().recordBuiltState(state);
  const result = await sendWatchTodayState(state);
  useWatchDebugStore.getState().recordSyncResult(result, source);

  return result;
}

export async function refreshEntitlementsAndSyncWatchTodayState(
  now = new Date(),
  source = 'auto',
): Promise<WatchSyncResult> {
  const auth = useAuthStore.getState();

  if (auth.accessToken) {
    await auth.refreshEntitlements();
  }

  return syncWatchTodayState(now, source);
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
  useWatchDebugStore.getState().recordIncomingPayload(payload);
  const replyId = extractReplyId(payload);

  if (isWatchStateRequest(payload)) {
    const state = getCurrentWatchTodayState();
    const stateJson = JSON.stringify(state);
    useWatchDebugStore.getState().recordBuiltState(state);
    const ack = {
      eventId: 'request_today_state',
      state,
      stateJson,
      status: 'accepted',
    } as const;
    useWatchDebugStore.getState().recordAck(ack);
    await replyToWatchMessage(replyId, ack);
    void syncWatchTodayState(new Date(), 'watch_state_request');
    return;
  }

  const event = extractWatchEvent(payload);

  if (!event) {
    const ack = {
      eventId: 'unknown',
      message: '手表消息格式不对。',
      status: 'rejected',
    } as const;
    useWatchDebugStore.getState().recordAck(ack);
    await replyToWatchMessage(replyId, ack);
    return;
  }

  const ack = await handleWatchEvent(event);
  const state = getCurrentWatchTodayState();
  const stateJson = JSON.stringify(state);
  const ackWithState = {
    ...ack,
    state,
    stateJson,
  };
  useWatchDebugStore.getState().recordBuiltState(state);
  useWatchDebugStore.getState().recordAck(ackWithState);
  await replyToWatchMessage(replyId, ackWithState);
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
