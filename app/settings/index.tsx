import { useRouter } from 'expo-router';
import { Bell, Monitor, Moon, ShieldCheck, Sun, Volume2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { OptionRow } from '../../src/components/OptionRow';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
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
          <Volume2 color={theme.colors.info} size={20} strokeWidth={2.3} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>声音与震动</Text>
            <Text style={styles.settingDescription}>练习和计时只轻轻震一下，系统通知默认不出声，不搞大场面。</Text>
          </View>
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
    },
    settingText: {
      flex: 1,
      marginLeft: 12,
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
