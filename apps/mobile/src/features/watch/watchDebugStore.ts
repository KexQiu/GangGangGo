import { create } from 'zustand';

import {
  type WatchConnectivityStatus,
  type WatchEventAck,
  type WatchSyncResult,
  type WatchTodayState,
} from './watchTypes';

type WatchDebugLogDirection = 'incoming' | 'outgoing' | 'state' | 'sync';

export type WatchDebugLog = {
  at: string;
  detail?: string;
  direction: WatchDebugLogDirection;
  id: string;
  title: string;
};

type WatchDebugState = {
  lastAck: null | WatchEventAck;
  lastBuiltState: null | WatchTodayState;
  lastConnectivityStatus: null | WatchConnectivityStatus;
  lastIncomingPayload: null | string;
  lastSyncResult: null | (WatchSyncResult & { at: string; source: string });
  logs: WatchDebugLog[];
  recordAck: (ack: WatchEventAck) => void;
  recordBuiltState: (state: WatchTodayState) => void;
  recordConnectivityStatus: (status: WatchConnectivityStatus) => void;
  recordIncomingPayload: (payload: unknown) => void;
  recordSyncResult: (result: WatchSyncResult, source: string) => void;
};

const maxLogs = 16;
const isWatchDebugEnabled = typeof __DEV__ !== 'undefined' && __DEV__;

export const useWatchDebugStore = create<WatchDebugState>((set) => ({
  lastAck: null,
  lastBuiltState: null,
  lastConnectivityStatus: null,
  lastIncomingPayload: null,
  lastSyncResult: null,
  logs: [],
  recordAck: (ack) => {
    if (!isWatchDebugEnabled) return;
    set((state) => ({
      lastAck: ack,
      logs: prependLog(state.logs, {
        detail: `eventId=${safeIdentifier(ack.eventId)}`,
        direction: 'outgoing',
        title: `ACK ${ack.status}`,
      }),
    }));
  },
  recordBuiltState: (builtState) => {
    if (!isWatchDebugEnabled) return;

    set((state) => ({
      lastBuiltState: builtState,
      logs: prependLog(state.logs, {
        detail: summarizeWatchStateForDebug(builtState),
        direction: 'state',
        title: '构建 WatchTodayState',
      }),
    }));
  },
  recordConnectivityStatus: (connectivityStatus) => {
    set({
      lastConnectivityStatus: connectivityStatus,
    });
  },
  recordIncomingPayload: (payload) => {
    if (!isWatchDebugEnabled) return;
    const summary = summarizeWatchPayloadForDebug(payload);
    set((state) => ({
      lastIncomingPayload: summary,
      logs: prependLog(state.logs, {
        detail: summary,
        direction: 'incoming',
        title: '收到 Watch 消息',
      }),
    }));
  },
  recordSyncResult: (result, source) => {
    if (!isWatchDebugEnabled) return;
    const at = new Date().toISOString();
    set((state) => ({
      lastSyncResult: {
        ...result,
        at,
        source,
      },
      logs: prependLog(state.logs, {
        detail: safeIdentifier(source),
        direction: 'sync',
        title: result.sent ? '同步已发出' : '同步未发出',
      }),
    }));
  },
}));

function prependLog(logs: WatchDebugLog[], entry: Omit<WatchDebugLog, 'at' | 'id'>): WatchDebugLog[] {
  const at = new Date().toISOString();
  const nextLog: WatchDebugLog = {
    ...entry,
    at,
    id: `${at}-${Math.random().toString(36).slice(2, 8)}`,
  };

  return [nextLog, ...logs].slice(0, maxLogs);
}

export function summarizeWatchPayloadForDebug(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'type=invalid';
  }

  const value = payload as {
    event?: { id?: unknown; type?: unknown };
    replyId?: unknown;
    type?: unknown;
  };

  if (value.type === 'request_today_state') {
    return `request_today_state · replyId=${safeIdentifier(value.replyId)}`;
  }

  if (value.type === 'watch_event') {
    return `${safeIdentifier(value.event?.type ?? 'watch_event')} · eventId=${safeIdentifier(value.event?.id)}`;
  }

  return 'type=unknown';
}

export function summarizeWatchStateForDebug(state: WatchTodayState): string {
  return `schema=${state.schemaVersion} · date=${safeIdentifier(state.date)} · actions=${state.canUseActions ? 'on' : 'off'}`;
}

function safeIdentifier(value: unknown): string {
  const normalized = typeof value === 'string' ? value : '-';
  return normalized.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80) || '-';
}
