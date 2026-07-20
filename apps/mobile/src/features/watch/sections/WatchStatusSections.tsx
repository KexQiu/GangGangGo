import { Text, View } from 'react-native';

import { isProStatus } from '../../account/accountModel';
import type { WatchConnectivityStatus, WatchSyncResult, WatchTodayState } from '../watchTypes';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/watchStyles';

export function StatusRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

export function formatWatchStatus(status: WatchConnectivityStatus): string {
  if (!status.isPaired) {
    return '还没有检测到已配对的 Apple Watch。';
  }

  if (!status.isWatchAppInstalled) {
    return 'Apple Watch App 还没有安装。';
  }

  return status.isReachable ? 'Apple Watch 当前可达。' : 'Apple Watch 暂时不可达，后续会走待同步队列。';
}

export function formatUnsupportedWatchMessage(isDevelopment: boolean): string {
  return isDevelopment
    ? '当前运行环境没有可用的 WatchConnectivity 原生模块，请使用 iOS development build 和 Xcode Watch target 联调。'
    : '当前设备暂时无法连接 Apple Watch，请确认已配对并安装手表 App。';
}

export function formatSyncResultMessage(result: WatchSyncResult, isDevelopment: boolean): string {
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

export function formatToiletState(state: WatchTodayState): string {
  const sessionCountText = `${state.toilet.sessionCount} 次`;

  if (!isProStatus(state.proStatus) || !state.toilet.isRunning) {
    return sessionCountText;
  }

  return state.toilet.isPaused ? `${sessionCountText} · 已暂停` : `${sessionCountText} · 进行中`;
}

export function formatProStatus(status: WatchTodayState['proStatus']) {
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

export function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) {
    return '未知';
  }

  return value ? '是' : '否';
}

export function formatBundleList(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return '无';
  }

  return values.join(', ');
}

export function formatDebugTime(value: string): string {
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

export function DebugRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue}>{value}</Text>
    </View>
  );
}
