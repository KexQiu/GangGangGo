import { useFocusEffect, useRouter } from 'expo-router';
import { RefreshCw, Watch } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { Screen } from '../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../src/features/account/authStore';
import { getWatchConnectivityStatus } from '../../src/features/watch/watchConnectivity';
import { getCurrentWatchTodayState, syncWatchTodayState } from '../../src/features/watch/watchSyncService';
import { type WatchConnectivityStatus, type WatchTodayState } from '../../src/features/watch/watchTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function WatchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const user = useAuthStore((state) => state.user);
  const proStatus = useAuthStore((state) => state.proStatus);
  const isPro = isProStatus(proStatus);
  const [status, setStatus] = useState<WatchConnectivityStatus | null>(null);
  const [todayState, setTodayState] = useState<WatchTodayState>(() => getCurrentWatchTodayState());
  const [message, setMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setTodayState(getCurrentWatchTodayState());
    setStatus(await getWatchConnectivityStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function syncNow() {
    setIsSyncing(true);
    setMessage(null);

    try {
      const result = await syncWatchTodayState();
      setTodayState(getCurrentWatchTodayState());
      setStatus(await getWatchConnectivityStatus());
      setMessage(result.sent ? '今日状态已发送给手表。' : 'WatchConnectivity 还没接入，当前只展示待同步状态。');
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
        subtitle="先把 iPhone 端同步骨架准备好，后续接 watchOS target 后就能真正联动。"
        title="Apple Watch 联动"
      />

      <PageStack gap="regular">
        <AppCard muted style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Watch color={colors.primaryPressed} size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.heroTitle}>{status?.isSupported ? '连接骨架已就绪' : '原生手表通道待接入'}</Text>
          <Text style={styles.heroBody}>
            {status?.isSupported
              ? formatWatchStatus(status)
              : '当前阶段已能生成低敏今日状态；真正发送到 Apple Watch 需要后续新增 watchOS target 和 WatchConnectivity 原生模块。'}
          </Text>
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
            <Text style={styles.noticeBody}>Apple Watch 联动属于小提督 Pro。当前可先查看同步状态骨架。</Text>
            <AppButton onPress={() => router.push(routes.pro)}>了解 Pro</AppButton>
          </AppCard>
        ) : null}

        <PageSection subtitle="这些字段会同步给手表，不包含敏感健康细节。" title="今日低敏状态">
          <AppCard style={styles.statusCard}>
            <StatusRow label="菊花抬" value={todayState.training.done ? `已完成 · ${todayState.training.completedSets} 组` : `${todayState.training.completedSets} 组`} />
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
              <Text style={styles.actionTitle}>同步测试</Text>
              <Text style={styles.actionBody}>现在会尝试调用 WatchConnectivity adapter；未接原生模块时会安全跳过。</Text>
            </View>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <AppButton disabled={isSyncing} onPress={() => void syncNow()} variant="secondary">
            {isSyncing ? '同步中...' : '同步今日状态'}
          </AppButton>
        </AppCard>
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

function formatToiletState(state: WatchTodayState): string {
  if (!state.toilet.isRunning) {
    return '未进行';
  }

  const minutes = Math.floor(state.toilet.elapsedSeconds / 60);
  const seconds = state.toilet.elapsedSeconds % 60;
  const time = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return state.toilet.isPaused ? `${time} · 已暂停` : `${time} · 进行中`;
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

