import { Activity, Bell, BellRing, Clock3, Moon, Move, ShieldCheck } from 'lucide-react-native';
import { type ComponentType } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import {
  getKegelTimesForCount,
  getQuietHoursLabel,
  getReminderHomeSummary,
  isQuietHoursDisabled,
  SEDENTARY_INTERVAL_OPTIONS,
} from '../../src/features/reminders/reminderLogic';
import { useReminderStore } from '../../src/features/reminders/reminderStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const kegelReminderCounts = [1, 2, 3];

const quietOptions = [
  {
    description: '夜里让小暗号闭麦',
    end: '08:30',
    start: '22:30',
    title: '夜间勿扰',
  },
  {
    description: '晚睡党也要安静落地',
    end: '08:00',
    start: '23:30',
    title: '晚睡模式',
  },
  {
    description: '小暗号全天待命',
    end: '00:00',
    start: '00:00',
    title: '关闭勿扰',
  },
] as const;

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const error = useReminderStore((state) => state.error);
  const isSyncing = useReminderStore((state) => state.isSyncing);
  const permissionStatus = useReminderStore((state) => state.permissionStatus);
  const requestPermissionAndSync = useReminderStore((state) => state.requestPermissionAndSync);
  const scheduledCount = useReminderStore((state) => state.scheduledCount);
  const settings = useReminderStore((state) => state.settings);
  const updateSettings = useReminderStore((state) => state.updateSettings);
  const summary = getReminderHomeSummary(settings);
  const needsPermission = (settings.kegelEnabled || settings.sedentaryEnabled) && permissionStatus !== 'granted';

  async function setKegelEnabled(enabled: boolean) {
    await updateSettings({ kegelEnabled: enabled });

    if (enabled && permissionStatus !== 'granted') {
      await requestPermissionAndSync();
    }
  }

  async function setSedentaryEnabled(enabled: boolean) {
    await updateSettings({ sedentaryEnabled: enabled });

    if (enabled && permissionStatus !== 'granted') {
      await requestPermissionAndSync();
    }
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.settings} title="提醒设置" />

      <PageHeader
        eyebrow="小暗号"
        subtitle="通知栏尽量说人话、留面子，不把尴尬词写满屏。"
        title="提醒小秘书"
      />

      <AppCard muted style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <BellRing color={colors.privacy} size={28} strokeWidth={2.4} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{summary.title}</Text>
          <Text style={styles.summaryText}>
            {permissionStatus === 'granted'
              ? `${summary.subtitle}，已排班 ${scheduledCount} 个小暗号。`
              : summary.subtitle}
          </Text>
        </View>
      </AppCard>

      {needsPermission ? (
        <AppCard style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <ShieldCheck color={colors.info} size={22} strokeWidth={2.4} />
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>让小暗号能出门</Text>
              <Text style={styles.permissionText}>不开权限也能保存设置，只是 App 退到后台后，小秘书没法敲门。</Text>
            </View>
          </View>
          <AppButton onPress={() => void requestPermissionAndSync()} style={styles.permissionButton}>
            {isSyncing ? '正在敲门...' : '开启系统通知'}
          </AppButton>
        </AppCard>
      ) : null}

      {error ? (
        <AppCard style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </AppCard>
      ) : null}

      <Text style={styles.groupTitle}>菊花抬提醒</Text>
      <AppCard style={styles.settingsCard}>
        <SettingHeader
          description="学名提肛训练，App 里叫菊花抬。到点轻轻敲门，不公开处刑。"
          icon={Activity}
          onValueChange={(enabled) => void setKegelEnabled(enabled)}
          title="到点小暗号"
          value={settings.kegelEnabled}
        />

        <Text style={styles.fieldLabel}>每天敲几次</Text>
        <View style={styles.segmentRow}>
          {kegelReminderCounts.map((count) => (
            <SegmentOption
              key={count}
              label={`${count} 次`}
              onPress={() => {
                void updateSettings({ kegelTimes: getKegelTimesForCount(count) });
              }}
              selected={settings.kegelTimes.length === count}
            />
          ))}
        </View>
        <Text style={styles.fieldNote}>暗号时间：{settings.kegelTimes.join('、')}</Text>
      </AppCard>

      <Text style={styles.groupTitle}>久坐提醒</Text>
      <AppCard style={styles.settingsCard}>
        <SettingHeader
          description="只按时间喊你动一动，不偷看坐姿，也不审判坐姿。"
          icon={Move}
          onValueChange={(enabled) => void setSedentaryEnabled(enabled)}
          title="起身透气提醒"
          value={settings.sedentaryEnabled}
        />

        <Text style={styles.fieldLabel}>隔多久喊一次</Text>
        <View style={styles.segmentRow}>
          {SEDENTARY_INTERVAL_OPTIONS.map((interval) => (
            <SegmentOption
              key={interval}
              label={`${interval} 分钟`}
              onPress={() => {
                void updateSettings({ sedentaryIntervalMinutes: interval });
              }}
              selected={settings.sedentaryIntervalMinutes === interval}
            />
          ))}
        </View>
      </AppCard>

      <Text style={styles.groupTitle}>隐私和勿扰</Text>
      <AppCard style={styles.settingsCard}>
        <SettingHeader
          description="开启后通知只显示小花、GGH、换个姿势这类暗号。"
          icon={Bell}
          onValueChange={(enabled) => {
            void updateSettings({ privacyMode: enabled });
          }}
          title="通知暗号模式"
          value={settings.privacyMode}
        />

        <View style={styles.divider} />

        <View style={styles.quietHeader}>
          <View style={styles.quietIcon}>
            <Moon color={colors.info} size={20} strokeWidth={2.3} />
          </View>
          <View style={styles.quietCopy}>
            <Text style={styles.quietTitle}>闭麦时间</Text>
            <Text style={styles.quietText}>当前：{getQuietHoursLabel(settings)}</Text>
          </View>
        </View>

        <View style={styles.quietList}>
          {quietOptions.map((option) => {
            const selected = settings.quietHoursStart === option.start && settings.quietHoursEnd === option.end;

            return (
              <Pressable
                key={option.title}
                onPress={() => {
                  void updateSettings({
                    quietHoursEnd: option.end,
                    quietHoursStart: option.start,
                  });
                }}
                style={({ pressed }) => [
                  styles.quietOption,
                  selected && styles.quietOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.quietOptionText}>
                  <Text style={styles.quietOptionTitle}>{option.title}</Text>
                  <Text style={styles.quietOptionDescription}>
                    {isQuietHoursDisabled({
                      ...settings,
                      quietHoursEnd: option.end,
                      quietHoursStart: option.start,
                    })
                      ? option.description
                      : `${option.start} - ${option.end} · ${option.description}`}
                  </Text>
                </View>
                {selected ? <Clock3 color={colors.primaryPressed} size={19} strokeWidth={2.4} /> : null}
              </Pressable>
            );
          })}
        </View>
      </AppCard>
    </Screen>
  );
}

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type SettingHeaderProps = {
  description: string;
  icon: ComponentType<IconProps>;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
};

function SettingHeader({ description, icon: Icon, onValueChange, title, value }: SettingHeaderProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.settingHeader}>
      <View style={styles.settingIcon}>
        <Icon color={value ? colors.primaryPressed : colors.textMuted} size={21} strokeWidth={2.4} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        ios_backgroundColor={colors.surfaceMuted}
        onValueChange={onValueChange}
        thumbColor={value ? colors.primary : colors.textSubtle}
        trackColor={{ false: colors.surfaceMuted, true: colors.primarySoft }}
        value={value}
      />
    </View>
  );
}

type SegmentOptionProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
};

function SegmentOption({ label, onPress, selected }: SegmentOptionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    summaryCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    summaryIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginRight: 14,
      width: 56,
    },
    summaryCopy: {
      flex: 1,
    },
    summaryTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 7,
    },
    summaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    permissionCard: {
      borderColor: colors.info,
      marginBottom: 18,
    },
    permissionHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginBottom: 16,
    },
    permissionCopy: {
      flex: 1,
      marginLeft: 10,
    },
    permissionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    permissionText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    permissionButton: {
      minHeight: 48,
    },
    errorCard: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      marginBottom: 18,
    },
    errorText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
      marginTop: 2,
    },
    settingsCard: {
      marginBottom: 22,
      padding: 18,
    },
    settingHeader: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    settingIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    settingCopy: {
      flex: 1,
      marginRight: 12,
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
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 10,
      marginTop: 18,
    },
    segmentRow: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      padding: 4,
    },
    segment: {
      alignItems: 'center',
      borderRadius: 14,
      flex: 1,
      justifyContent: 'center',
      minHeight: 42,
    },
    segmentSelected: {
      backgroundColor: colors.surface,
    },
    segmentText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    segmentTextSelected: {
      color: colors.primaryPressed,
    },
    fieldNote: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 10,
    },
    divider: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 18,
    },
    quietHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 14,
    },
    quietIcon: {
      alignItems: 'center',
      backgroundColor: colors.infoSoft,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    quietCopy: {
      flex: 1,
    },
    quietTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    quietText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
    quietList: {
      gap: 10,
    },
    quietOption: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    quietOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    quietOptionText: {
      flex: 1,
      marginRight: 10,
    },
    quietOptionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    quietOptionDescription: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    pressed: {
      opacity: 0.82,
    },
  });
}
