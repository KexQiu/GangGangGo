import type { DataSyncOverview } from '../../storage/dataSyncOutbox';
import type { SyncTaskStatus } from './syncCoordinatorCore';

export function getDataSyncMessage(
  task: SyncTaskStatus,
  overview: DataSyncOverview | null,
  reading: boolean,
  readError: string | null,
) {
  if (task.phase === 'running') return '正在同步完整记录…';
  if (task.phase === 'error') return `同步未完成：${task.lastError ?? '请稍后重试。'}`;
  if (readError) return '无法读取本机同步状态。';
  if (reading || !overview) return '正在读取同步状态…';
  if (overview.pendingCount > 0) return `${overview.pendingCount} 项更改待上传。`;
  if (task.phase === 'skipped') return task.skipReason ?? '本轮同步已跳过。';
  if (task.phase === 'success') return '本轮同步已完成。';
  return '等待本轮同步确认。';
}
