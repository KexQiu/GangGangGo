import { describe, expect, it } from 'vitest';
import { getDataSyncMessage } from '../dataSyncPresentation';
import type { SyncTaskStatus } from '../syncCoordinatorCore';

const idle: SyncTaskStatus = {
  phase: 'idle',
  lastError: null,
  lastFinishedAt: null,
  lastSucceededAt: null,
  skipReason: null,
};
const overview = { pendingCount: 0, lastCompletedAt: '2026-09-29T00:00:00Z' };

describe('record sync status shown to users', () => {
  it('does not imply current completion from login, old success time or zero pending records', () => {
    expect(getDataSyncMessage(idle, overview, false, null)).toBe('等待本轮同步确认。');
  });
  it('does not hide pending changes behind a previous successful task', () => {
    expect(getDataSyncMessage({ ...idle, phase: 'success' }, { ...overview, pendingCount: 3 }, false, null)).toBe(
      '3 项更改待上传。',
    );
  });
  it('distinguishes sync failure from local status read failure and never calls either synchronized', () => {
    expect(getDataSyncMessage({ ...idle, phase: 'error', lastError: 'offline' }, overview, false, null)).toContain(
      '同步未完成',
    );
    expect(getDataSyncMessage({ ...idle, phase: 'success' }, overview, false, 'disk failed')).toBe(
      '无法读取本机同步状态。',
    );
    expect(getDataSyncMessage({ ...idle, phase: 'success' }, overview, true, null)).toBe('正在读取同步状态…');
  });
  it('shows running and skipped states explicitly', () => {
    expect(getDataSyncMessage({ ...idle, phase: 'running' }, overview, false, null)).toContain('正在同步');
    expect(getDataSyncMessage({ ...idle, phase: 'skipped', skipReason: '账号已变更' }, overview, false, null)).toBe(
      '账号已变更',
    );
  });
});
