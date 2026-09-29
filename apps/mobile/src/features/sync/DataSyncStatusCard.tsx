import { useCallback, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';

import { authSessionContext } from '../../api/sessionContext';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { LocalReadResource } from '../../storage/localReadResource';
import { readDataSyncOverview, type DataSyncOverview } from '../../storage/dataSyncOutbox';
import { useAppTheme } from '../../theme/themeProvider';
import { useAuthStore } from '../account/authStore';
import { subscribeToLocalDataChanges } from './localDataEvents';
import { syncCoordinator } from './syncCoordinator';
import { getDataSyncMessage } from './dataSyncPresentation';

const subscribeStatuses = (listener: () => void) => syncCoordinator.subscribeTaskStatuses(listener);

export function DataSyncStatusCard() {
  const { colors } = useAppTheme();
  const token = useAuthStore((state) => state.accessToken);
  const authLoading = useAuthStore((state) => state.isLoading || !state.hasHydrated);
  const [reader] = useState(() => new LocalReadResource<DataSyncOverview>());
  const overviewState = useSyncExternalStore(reader.subscribe, reader.getSnapshot);
  const statuses = useSyncExternalStore(subscribeStatuses, syncCoordinator.getSnapshot);
  const owner = !authLoading ? authSessionContext.current() : null;
  const task =
    syncCoordinator.getSessionKey() === owner?.generation
      ? statuses.data
      : {
          phase: 'idle' as const,
          lastError: null,
          lastFinishedAt: null,
          lastSucceededAt: null,
          skipReason: null,
        };
  const refresh = useCallback(() => {
    const current = authSessionContext.current();
    if (!current) {
      reader.reset();
      return;
    }
    void reader.load(current.profileId, () => readDataSyncOverview(current.profileId));
  }, [reader]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !token) {
        reader.reset();
        return;
      }
      refresh();
      const unsubscribeData = subscribeToLocalDataChanges(refresh);
      let previous = syncCoordinator.getSnapshot().data;
      const unsubscribeStatus = syncCoordinator.subscribeTaskStatuses((next) => {
        if (next.data.lastFinishedAt !== previous.lastFinishedAt || next.data.phase !== previous.phase) refresh();
        previous = next.data;
      });
      return () => {
        reader.cancel();
        unsubscribeData();
        unsubscribeStatus();
      };
    }, [reader, refresh, token, authLoading]),
  );

  if (!owner || !token) return null;
  const current = overviewState.generation === owner.generation && overviewState.key === owner.profileId;
  const overview = current ? overviewState.data : null;
  const readError = current ? overviewState.error : null;
  const reading = !current || overviewState.phase === 'loading';
  return (
    <AppCard>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>记录同步</Text>
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: task.phase === 'error' || readError ? colors.danger : colors.textMuted }}
      >
        {getDataSyncMessage(task, overview, reading, readError)}
      </Text>
      <Text style={{ color: colors.textMuted }}>
        最近完整同步：
        {overview?.lastCompletedAt ? new Date(overview.lastCompletedAt).toLocaleString() : '暂无已确认时间'}
      </Text>
      {overview ? (
        <Text style={{ color: colors.textMuted }}>
          待上传：{overview.pendingCount} 项更改{reading || readError ? '（上次读取）' : ''}
        </Text>
      ) : null}
      {readError ? (
        <>
          <Text style={{ color: colors.danger }}>{readError}</Text>
          <AppButton variant="secondary" onPress={refresh}>
            重新读取同步状态
          </AppButton>
        </>
      ) : null}
      <AppButton
        disabled={task.phase === 'running'}
        variant="secondary"
        onPress={() => syncCoordinator.retryTask('data')}
      >
        {task.phase === 'running' ? '同步中…' : task.phase === 'error' ? '重试记录同步' : '立即同步记录'}
      </AppButton>
      <Text style={{ color: colors.textMuted }}>待补充草稿只保存在本机，正式保存后才会同步。</Text>
    </AppCard>
  );
}
