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

export const useWatchDebugStore = create<WatchDebugState>((set) => ({
  lastAck: null,
  lastBuiltState: null,
  lastConnectivityStatus: null,
  lastIncomingPayload: null,
  lastSyncResult: null,
  logs: [],
  recordAck: (ack) => {
    set((state) => ({
      lastAck: ack,
      logs: prependLog(state.logs, {
        detail: ack.message ?? `eventId=${ack.eventId}`,
        direction: 'outgoing',
        title: `ACK ${ack.status}`,
      }),
    }));
  },
  recordBuiltState: (builtState) => {
    const toiletDetail = `${builtState.toilet.sessionCount} 次`;

    set((state) => ({
      lastBuiltState: builtState,
      logs: prependLog(state.logs, {
        detail: `${builtState.date} · 小账本 ${builtState.habits.completion}/4 · 蹲会儿 ${toiletDetail}`,
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
    const summary = summarizePayload(payload);
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
    const at = new Date().toISOString();
    set((state) => ({
      lastSyncResult: {
        ...result,
        at,
        source,
      },
      logs: prependLog(state.logs, {
        detail: result.sent ? source : `${source} · ${result.reason ?? 'unknown'}`,
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

function summarizePayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return String(payload);
  }

  const value = payload as {
    event?: { id?: unknown; type?: unknown };
    replyId?: unknown;
    type?: unknown;
  };

  if (value.type === 'request_today_state') {
    return `request_today_state · replyId=${String(value.replyId ?? '-')}`;
  }

  if (value.type === 'watch_event') {
    return `${String(value.event?.type ?? 'watch_event')} · eventId=${String(value.event?.id ?? '-')}`;
  }

  return `type=${String(value.type ?? 'unknown')}`;
}
