import { useFocusEffect, useRouter } from 'expo-router';
import { Bug, RefreshCw, Watch } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { Screen } from '../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../src/features/account/authStore';
import { getWatchConnectivityDebugInfo, getWatchConnectivityStatus } from '../../src/features/watch/watchConnectivity';
import { useWatchDebugStore } from '../../src/features/watch/watchDebugStore';
import {
  getCurrentWatchTodayState,
  refreshEntitlementsAndSyncWatchTodayState,
} from '../../src/features/watch/watchSyncService';
import {
  type WatchConnectivityDebugInfo,
  type WatchConnectivityStatus,
  type WatchSyncResult,
  type WatchTodayState,
} from '../../src/features/watch/watchTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function WatchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isDevelopment = __DEV__;
  const user = useAuthStore((state) => state.user);
  const proStatus = useAuthStore((state) => state.proStatus);
  const isPro = isProStatus(proStatus);
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
      <PageHeader
        eyebrow="手腕小助手"
        subtitle="把今日低敏状态同步到手表，Pro 用户可在 Watch 上完成轻量操作。"
        title="Apple Watch 联动"
      />

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
            <Text style={styles.noticeBody}>Apple Watch 联动需要账号和 Pro 权益。v0.1 本地功能不受影响。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去我的页面登录</AppButton>
          </AppCard>
        ) : null}

        {user && !isPro ? (
          <AppCard style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>手腕小助手在 Pro 里</Text>
            <Text style={styles.noticeBody}>Apple Watch 联动属于小提督 Pro。当前仍可查看低敏只读状态。</Text>
            <AppButton onPress={() => router.push(routes.pro)}>了解 Pro</AppButton>
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
            <StatusRow label="权益" value={formatProStatus(todayState.proStatus)} />
          </AppCard>
        </PageSection>

        <AppCard style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <RefreshCw color={colors.info} size={22} strokeWidth={2.4} />
            <View style={styles.copy}>
              <Text style={styles.actionTitle}>同步到手表</Text>
              <Text style={styles.actionBody}>会先刷新 Pro 权益，再把低敏今日状态发送给手表。</Text>
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

function StatusRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function formatWatchStatus(status: WatchConnectivityStatus): string {
  if (!status.isPaired) {
    return '还没有检测到已配对的 Apple Watch。';
  }

  if (!status.isWatchAppInstalled) {
    return 'Apple Watch App 还没有安装。';
  }

  return status.isReachable ? 'Apple Watch 当前可达。' : 'Apple Watch 暂时不可达，后续会走待同步队列。';
}

function formatUnsupportedWatchMessage(isDevelopment: boolean): string {
  return isDevelopment
    ? '当前运行环境没有可用的 WatchConnectivity 原生模块，请使用 iOS development build 和 Xcode Watch target 联调。'
    : '当前设备暂时无法连接 Apple Watch，请确认已配对并安装手表 App。';
}

function formatSyncResultMessage(result: WatchSyncResult, isDevelopment: boolean): string {
  if (result.sent) {
    return '今日状态已发送给手表。';
  }

  switch (result.reason) {
    case 'watch_app_not_installed':
      return isDevelopment
        ? '系统还没识别到小提督 Watch App，请重新运行 Watch target 后再试。'
        : '请先在 Apple Watch 上安装小提督。';
    case 'watch_connectivity_unavailable':
      return isDevelopment
        ? 'WatchConnectivity 原生通道未接入，请重新安装当前 iOS 构建。'
        : '当前设备暂时无法连接 Apple Watch。';
    case 'watch_not_paired':
      return '还没有检测到已配对的 Apple Watch。';
    case 'watch_session_unavailable':
      return isDevelopment ? '当前设备暂时不支持 WatchConnectivity。' : '当前设备暂时无法连接 Apple Watch。';
    default:
      if (isDevelopment && result.reason) {
        return `同步到手表失败：${result.reason}`;
      }

      return '同步到手表失败，请稍后再试。';
  }
}

function formatToiletState(state: WatchTodayState): string {
  const sessionCountText = `${state.toilet.sessionCount} 次`;

  if (!isProStatus(state.proStatus) || !state.toilet.isRunning) {
    return sessionCountText;
  }

  return state.toilet.isPaused ? `${sessionCountText} · 已暂停` : `${sessionCountText} · 进行中`;
}

function formatProStatus(status: WatchTodayState['proStatus']) {
  switch (status) {
    case 'pro_active':
      return 'Pro 已开启';
    case 'pro_grace_period':
      return 'Pro 宽限期';
    case 'pro_expired':
      return 'Pro 已过期';
    case 'free':
    default:
      return '免费版';
  }
}

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) {
    return '未知';
  }

  return value ? '是' : '否';
}

function formatBundleList(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return '无';
  }

  return values.join(', ');
}

function formatDebugTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function DebugRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue}>{value}</Text>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    actionCard: {
      gap: 14,
    },
    actionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    actionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 4,
    },
    copy: {
      flex: 1,
    },
    debugCard: {
      gap: 12,
    },
    debugLabel: {
      color: colors.textMuted,
      flexShrink: 0,
      fontSize: 12,
      fontWeight: '800',
      width: 88,
    },
    debugRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    debugRows: {
      gap: 8,
    },
    debugTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 21,
    },
    debugValue: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'right',
    },
    divider: {
      backgroundColor: colors.border,
      height: 1,
    },
    heroBody: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    heroCard: {
      alignItems: 'center',
      gap: 10,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 21,
      fontWeight: '900',
      textAlign: 'center',
    },
    message: {
      color: colors.info,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 19,
    },
    noticeBody: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
    },
    noticeCard: {
      gap: 12,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    jsonText: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
      padding: 12,
    },
    logDetail: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    logHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    logItem: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 4,
      paddingTop: 10,
    },
    logTime: {
      color: colors.textSubtle,
      fontSize: 11,
      fontWeight: '700',
    },
    logTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '900',
    },
    statusCard: {
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    statusLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    statusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 46,
    },
    statusValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
  });
}
