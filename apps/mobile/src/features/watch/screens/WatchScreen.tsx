import {
  DebugRow,
  StatusRow,
  formatBoolean,
  formatBundleList,
  formatDebugTime,
  formatSyncResultMessage,
  formatToiletState,
  formatUnsupportedWatchMessage,
  formatWatchStatus,
} from '../sections/WatchStatusSections';
import { createStyles } from '../styles/watchStyles';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bug, RefreshCw, Watch } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PageHeader } from '../../../components/PageHeader';
import { PageSection, PageStack } from '../../../components/PageStack';
import { Screen } from '../../../components/Screen';
import { canAccessFeature } from '../../../features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../../features/account/accountQueries';
import { getWatchConnectivityDebugInfo, getWatchConnectivityStatus } from '../../../features/watch/watchConnectivity';
import { useWatchDebugStore } from '../../../features/watch/watchDebugStore';
import {
  getCurrentWatchTodayState,
  refreshEntitlementsAndSyncWatchTodayState,
} from '../../../features/watch/watchSyncService';
import {
  type WatchConnectivityDebugInfo,
  type WatchConnectivityStatus,
  type WatchTodayState,
} from '../../../features/watch/watchTypes';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';
import { trackGrowthEvent } from '../../growth/growthEventTracker';

export default function WatchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isDevelopment = __DEV__;
  const user = useCurrentUserQuery().data;
  const entitlementsQuery = useEntitlementsQuery();
  const entitlements = entitlementsQuery.data;
  const canUseActions = Boolean(user) && canAccessFeature(entitlements, 'watchActions');
  const [status, setStatus] = useState<WatchConnectivityStatus | null>(null);
  const [debugInfo, setDebugInfo] = useState<WatchConnectivityDebugInfo | null>(null);
  const [todayState, setTodayState] = useState<WatchTodayState>(() => getCurrentWatchTodayState());
  const [message, setMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastAck = useWatchDebugStore((state) => state.lastAck);
  const lastBuiltState = useWatchDebugStore((state) => state.lastBuiltState);
  const lastConnectivityStatus = useWatchDebugStore((state) => state.lastConnectivityStatus);
  const lastIncomingPayload = useWatchDebugStore((state) => state.lastIncomingPayload);
  const lastSyncResult = useWatchDebugStore((state) => state.lastSyncResult);
  const logs = useWatchDebugStore((state) => state.logs);
  const recordConnectivityStatus = useWatchDebugStore((state) => state.recordConnectivityStatus);
  const stateJson = isDevelopment ? JSON.stringify(lastBuiltState ?? todayState, null, 2) : '';
  const heroTitle =
    status === null ? '正在检查 Watch 通道' : status.isSupported ? 'Watch 通道已接入' : '手表通道暂不可用';
  const heroBody =
    status === null
      ? '正在读取 iPhone 与 Apple Watch 的连接状态。'
      : status.isSupported
        ? formatWatchStatus(status)
        : formatUnsupportedWatchMessage(isDevelopment);

  const refresh = useCallback(async () => {
    await refreshEntitlementsAndSyncWatchTodayState(new Date(), 'watch_page_focus');
    setTodayState(getCurrentWatchTodayState());
    if (isDevelopment) {
      const nextDebugInfo = await getWatchConnectivityDebugInfo();
      setDebugInfo(nextDebugInfo);
      setStatus(nextDebugInfo);
      recordConnectivityStatus(nextDebugInfo);
      return;
    }

    const nextStatus = await getWatchConnectivityStatus();
    setDebugInfo(null);
    setStatus(nextStatus);
    recordConnectivityStatus(nextStatus);
  }, [isDevelopment, recordConnectivityStatus]);

  useFocusEffect(
    useCallback(() => {
      trackGrowthEvent('watch_opened', { feature: 'watch', source: 'watch' });
      void refresh();
    }, [refresh]),
  );

  async function syncNow() {
    setIsSyncing(true);
    setMessage(null);

    try {
      const result = await refreshEntitlementsAndSyncWatchTodayState(new Date(), 'watch_page_manual');
      setTodayState(getCurrentWatchTodayState());
      if (isDevelopment) {
        const nextDebugInfo = await getWatchConnectivityDebugInfo();
        setDebugInfo(nextDebugInfo);
        setStatus(nextDebugInfo);
        recordConnectivityStatus(nextDebugInfo);
      } else {
        const nextStatus = await getWatchConnectivityStatus();
        setDebugInfo(null);
        setStatus(nextStatus);
        recordConnectivityStatus(nextStatus);
      }
      setMessage(formatSyncResultMessage(result, isDevelopment));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '同步到手表失败。');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.me} title="Apple Watch" />
      <PageHeader subtitle="把今日低敏状态同步到手表，也可以直接在手腕上完成轻量操作。" title="Apple Watch 联动" />

      <PageStack gap="regular">
        <AppCard muted style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Watch color={colors.primaryPressed} size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroBody}>{heroBody}</Text>
        </AppCard>

        {!user ? (
          <AppCard style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>先登录小提督</Text>
            <Text style={styles.noticeBody}>登录后就能同步今日状态，并在手表上完成训练、打卡和计时操作。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去我的页面登录</AppButton>
          </AppCard>
        ) : null}

        {user && entitlements && !canUseActions ? (
          <AppCard style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>手表操作暂不可用</Text>
            <Text style={styles.noticeBody}>请刷新账号状态后重试；今日低敏状态仍可正常同步。</Text>
          </AppCard>
        ) : null}

        <PageSection subtitle="这些字段会同步给手表，不包含敏感健康细节。" title="今日低敏状态">
          <AppCard style={styles.statusCard}>
            <StatusRow
              label="菊花抬"
              value={
                todayState.training.done
                  ? `已完成 · ${todayState.training.completedSets} 组`
                  : `${todayState.training.completedSets} 组`
              }
            />
            <View style={styles.divider} />
            <StatusRow label="小账本" value={`${todayState.habits.completion}/4`} />
            <View style={styles.divider} />
            <StatusRow label="蹲会儿" value={formatToiletState(todayState)} />
            <View style={styles.divider} />
            <StatusRow
              label="手表操作"
              value={
                user && !entitlements && entitlementsQuery.isFetching
                  ? '读取中'
                  : todayState.canUseActions
                    ? '已启用'
                    : user
                      ? '暂不可用'
                      : '登录后可用'
              }
            />
          </AppCard>
        </PageSection>

        <AppCard style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <RefreshCw color={colors.info} size={22} strokeWidth={2.4} />
            <View style={styles.copy}>
              <Text style={styles.actionTitle}>同步到手表</Text>
              <Text style={styles.actionBody}>会先刷新账号能力，再把低敏今日状态发送给手表。</Text>
            </View>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <AppButton disabled={isSyncing} onPress={() => void syncNow()} variant="secondary">
            {isSyncing ? '同步中...' : '同步今日状态'}
          </AppButton>
        </AppCard>

        {isDevelopment ? (
          <PageSection subtitle="用于定位 App 到 Watch、Watch 到 App 的同步链路。" title="联动调试">
            <AppCard style={styles.debugCard}>
              <View style={styles.actionHeader}>
                <Bug color={colors.privacy} size={22} strokeWidth={2.4} />
                <View style={styles.copy}>
                  <Text style={styles.actionTitle}>连接状态</Text>
                  <Text style={styles.actionBody}>这些值来自 iPhone 原生 WatchConnectivity。</Text>
                </View>
              </View>
              <View style={styles.debugRows}>
                <StatusRow label="支持" value={formatBoolean((lastConnectivityStatus ?? status)?.isSupported)} />
                <StatusRow label="已配对" value={formatBoolean((lastConnectivityStatus ?? status)?.isPaired)} />
                <StatusRow
                  label="Watch App"
                  value={formatBoolean((lastConnectivityStatus ?? status)?.isWatchAppInstalled)}
                />
                <StatusRow label="可达" value={formatBoolean((lastConnectivityStatus ?? status)?.isReachable)} />
                <StatusRow label="激活" value={debugInfo?.activationState ?? '未知'} />
              </View>
            </AppCard>

            <AppCard style={styles.debugCard}>
              <Text style={styles.debugTitle}>最近记录</Text>
              <DebugRow
                label="最近构建"
                value={lastBuiltState ? formatDebugTime(lastBuiltState.generatedAt) : '暂无'}
              />
              <DebugRow
                label="最近发送"
                value={
                  lastSyncResult
                    ? `${lastSyncResult.sent ? '已发出' : '未发出'} · ${lastSyncResult.source}${lastSyncResult.reason ? ` · ${lastSyncResult.reason}` : ''}`
                    : '暂无'
                }
              />
              <DebugRow label="最近 Watch 消息" value={lastIncomingPayload ?? '暂无'} />
              <DebugRow label="最近 ACK" value={lastAck ? `${lastAck.status} · ${lastAck.eventId}` : '暂无'} />
              <DebugRow label="iPhone Bundle" value={debugInfo?.iPhoneBundleIdentifier ?? '未知'} />
              <DebugRow label="嵌入 Watch" value={formatBundleList(debugInfo?.embeddedWatchBundleIdentifiers)} />
              <DebugRow label="激活错误" value={debugInfo?.activationError ?? '无'} />
            </AppCard>

            <AppCard style={styles.debugCard}>
              <Text style={styles.debugTitle}>当前待同步 JSON</Text>
              <Text selectable style={styles.jsonText}>
                {stateJson}
              </Text>
            </AppCard>

            <AppCard style={styles.debugCard}>
              <Text style={styles.debugTitle}>事件日志</Text>
              {logs.length > 0 ? (
                logs.slice(0, 8).map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logTitle}>{log.title}</Text>
                      <Text style={styles.logTime}>{formatDebugTime(log.at)}</Text>
                    </View>
                    {log.detail ? <Text style={styles.logDetail}>{log.detail}</Text> : null}
                  </View>
                ))
              ) : (
                <Text style={styles.actionBody}>还没有同步日志。点一次同步或在 Watch 上操作后会出现记录。</Text>
              )}
            </AppCard>
          </PageSection>
        ) : null}
      </PageStack>
    </Screen>
  );
}
