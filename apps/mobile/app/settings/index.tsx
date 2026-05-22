import { useRouter } from 'expo-router';
import { Bell, Monitor, Moon, ShieldCheck, Smartphone, Sun, Volume2 } from 'lucide-react-native';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { OptionRow } from '../../src/components/OptionRow';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { useAppSettingsStore } from '../../src/features/settings/appSettingsStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';
import { type ThemeMode } from '../../src/theme/themeStore';

const themeOptions: Array<{
  description: string;
  icon: typeof Monitor;
  mode: ThemeMode;
  title: string;
}> = [
  {
    description: '系统换脸，App 也跟着换',
    icon: Monitor,
    mode: 'system',
    title: '跟随系统',
  },
  {
    description: '白天感更足，页面更清爽',
    icon: Sun,
    mode: 'light',
    title: '浅色模式',
  },
  {
    description: '夜里更低调，不刺眼',
    icon: Moon,
    mode: 'dark',
    title: '深色模式',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const toiletLiveActivityEnabled = useAppSettingsStore((state) => state.toiletLiveActivityEnabled);
  const toiletStageNotificationEnabled = useAppSettingsStore((state) => state.toiletStageNotificationEnabled);
  const toiletStageSoundEnabled = useAppSettingsStore((state) => state.toiletStageSoundEnabled);
  const setToiletLiveActivityEnabled = useAppSettingsStore((state) => state.setToiletLiveActivityEnabled);
  const setToiletStageNotificationEnabled = useAppSettingsStore((state) => state.setToiletStageNotificationEnabled);
  const setToiletStageSoundEnabled = useAppSettingsStore((state) => state.setToiletStageSoundEnabled);
  const styles = createStyles(theme.colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="设置" />

      <PageHeader eyebrow="我的" subtitle="提醒、外观和安全说明都放这里，低调但管用。" title="设置" />

      <Text style={styles.groupTitle}>外观模式</Text>
      <View style={styles.optionGroup}>
        {themeOptions.map((option) => (
          <OptionRow
            description={option.description}
            icon={option.icon}
            key={option.mode}
            onPress={() => theme.setThemeMode(option.mode)}
            selected={theme.themeMode === option.mode}
            title={option.title}
          />
        ))}
      </View>

      <Text style={styles.groupTitle}>应用设置</Text>
      <AppCard style={styles.settingsCard}>
        <View style={styles.settingLine}>
          <Bell color={theme.colors.privacy} size={20} strokeWidth={2.3} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>小暗号设置</Text>
            <Text style={styles.settingDescription}>安排菊花抬、起身透气、闭麦时间和通知暗号。</Text>
          </View>
        </View>
        <AppButton onPress={() => router.push(routes.reminders)} style={styles.inlineButton} variant="secondary">
          管理暗号
        </AppButton>

        <View style={styles.divider} />

        <View style={styles.settingLine}>
          <ShieldCheck color={theme.colors.info} size={20} strokeWidth={2.3} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>安全说明</Text>
            <Text style={styles.settingDescription}>轻松练可以，明显便血、剧烈疼痛或不适加重要认真处理。</Text>
          </View>
        </View>
        <AppButton onPress={() => router.push(routes.safety)} style={styles.inlineButton} variant="secondary">
          查看安全说明
        </AppButton>

        <View style={styles.divider} />

        <View style={styles.settingLine}>
          <Smartphone color={theme.colors.privacy} size={20} strokeWidth={2.3} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>灵动岛计时</Text>
            <Text style={styles.settingDescription}>
              开启后，锁屏和灵动岛会显示蹲会儿计时。适合真机开发包，不在 Expo Go 生效。
            </Text>
          </View>
          <Switch
            accessibilityLabel="灵动岛计时"
            ios_backgroundColor={theme.colors.border}
            onValueChange={setToiletLiveActivityEnabled}
            thumbColor={toiletLiveActivityEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primarySoft,
            }}
            value={toiletLiveActivityEnabled}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingLine}>
          <Volume2 color={theme.colors.info} size={20} strokeWidth={2.3} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>声音与震动</Text>
            <Text style={styles.settingDescription}>蹲会儿阶段可以轻轻提醒，系统通知默认不出声，不搞大场面。</Text>
          </View>
        </View>

        <View style={styles.switchLine}>
          <View style={styles.settingText}>
            <Text style={styles.switchTitle}>蹲会儿离开提醒</Text>
            <Text style={styles.settingDescription}>离开 App 后，到 5/10/15/20 分钟用消息轻轻敲门。</Text>
          </View>
          <Switch
            accessibilityLabel="蹲会儿离开提醒"
            ios_backgroundColor={theme.colors.border}
            onValueChange={setToiletStageNotificationEnabled}
            thumbColor={toiletStageNotificationEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primarySoft,
            }}
            value={toiletStageNotificationEnabled}
          />
        </View>

        <View style={styles.switchLine}>
          <View style={styles.settingText}>
            <Text style={styles.switchTitle}>阶段音效</Text>
            <Text style={styles.settingDescription}>在 App 内切换阶段时播放短音效，5 分钟轻敲门，后面逐步认真。</Text>
          </View>
          <Switch
            accessibilityLabel="阶段音效"
            ios_backgroundColor={theme.colors.border}
            onValueChange={setToiletStageSoundEnabled}
            thumbColor={toiletStageSoundEnabled ? theme.colors.primary : theme.colors.surface}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primarySoft,
            }}
            value={toiletStageSoundEnabled}
          />
        </View>
      </AppCard>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    groupTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
      marginTop: 2,
    },
    optionGroup: {
      marginBottom: 24,
    },
    settingsCard: {
      paddingVertical: 18,
    },
    settingLine: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    settingText: {
      flex: 1,
    },
    settingTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    settingDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    switchLine: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    switchTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    inlineButton: {
      marginTop: 14,
      minHeight: 46,
    },
    divider: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 18,
    },
  });
}
