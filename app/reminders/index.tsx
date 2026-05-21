import {
  Bell,
  BellRing,
  Check,
  Clock3,
  Coffee,
  Minus,
  Moon,
  Move,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import { type ComponentType } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import {
  DEFAULT_LUNCH_QUIET_HOURS_END,
  DEFAULT_LUNCH_QUIET_HOURS_START,
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  getKegelTimesForCount,
  getQuietHoursLabel,
  getReminderHomeSummary,
  MAX_QUIET_HOURS_RANGES,
  parseTimeToMinutes,
  SEDENTARY_INTERVAL_OPTIONS,
} from '../../src/features/reminders/reminderLogic';
import { useReminderStore } from '../../src/features/reminders/reminderStore';
import { type QuietHoursRange } from '../../src/features/reminders/reminderTypes';
import { FlowerLiftIcon } from '../../src/features/training/FlowerLiftIcon';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const kegelReminderCounts = [1, 2, 3];

const quietOptions = [
  {
    description: '夜里让小暗号闭麦',
    ranges: [
      {
        end: DEFAULT_QUIET_HOURS_END,
        id: 'night',
        start: DEFAULT_QUIET_HOURS_START,
      },
    ],
    title: '夜间勿扰',
  },
  {
    description: '午休和夜里都安静，适合正常作息',
    ranges: [
      {
        end: DEFAULT_LUNCH_QUIET_HOURS_END,
        id: 'lunch',
        start: DEFAULT_LUNCH_QUIET_HOURS_START,
      },
      {
        end: DEFAULT_QUIET_HOURS_END,
        id: 'night',
        start: DEFAULT_QUIET_HOURS_START,
      },
    ],
    title: '午休 + 夜间',
  },
  {
    description: '小暗号全天待命',
    ranges: [],
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

  function updateQuietRanges(ranges: QuietHoursRange[]) {
    const nextRanges = ranges.slice(0, MAX_QUIET_HOURS_RANGES);
    const primaryRange = nextRanges[0];

    void updateSettings({
      quietHoursEnd: primaryRange?.end ?? '00:00',
      quietHoursRanges: nextRanges,
      quietHoursStart: primaryRange?.start ?? '00:00',
    });
  }

  function applyQuietPreset(ranges: readonly QuietHoursRange[]) {
    updateQuietRanges(ranges.map((range) => ({ ...range })));
  }

  function addQuietRange(range: QuietHoursRange) {
    if (settings.quietHoursRanges.length >= MAX_QUIET_HOURS_RANGES) {
      return;
    }

    const existingRange = settings.quietHoursRanges.some(
      (item) => item.start === range.start && item.end === range.end,
    );

    if (existingRange) {
      return;
    }

    updateQuietRanges([...settings.quietHoursRanges, range]);
  }

  function removeQuietRange(rangeId: string) {
    updateQuietRanges(settings.quietHoursRanges.filter((range) => range.id !== rangeId));
  }

  function moveQuietRangeTime(rangeId: string, field: 'end' | 'start', deltaMinutes: number) {
    const nextRanges = settings.quietHoursRanges.map((range) => {
      if (range.id !== rangeId) {
        return range;
      }

      const nextTime = addMinutesToTime(range[field], deltaMinutes);
      const oppositeField = field === 'start' ? 'end' : 'start';

      if (nextTime === range[oppositeField]) {
        return range;
      }

      return {
        ...range,
        [field]: nextTime,
      };
    });

    updateQuietRanges(nextRanges);
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
          icon={FlowerLiftIcon}
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
          description="开启后通知只显示小花、小提督、换个姿势这类暗号。"
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

        <Text style={styles.fieldLabel}>快速设定</Text>
        <View style={styles.quietList}>
          {quietOptions.map((option) => {
            const selected = areQuietRangesEqual(settings.quietHoursRanges, option.ranges);

            return (
              <Pressable
                key={option.title}
                onPress={() => {
                  applyQuietPreset(option.ranges);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.quietOption,
                  selected && styles.quietOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.quietOptionText}>
                  <Text style={styles.quietOptionTitle}>{option.title}</Text>
                  <Text style={styles.quietOptionDescription}>
                    {option.ranges.length === 0
                      ? option.description
                      : `${option.ranges.map(formatRange).join('、')} · ${option.description}`}
                  </Text>
                </View>
                {selected ? <Check color={colors.primaryPressed} size={19} strokeWidth={2.4} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.manualQuietHeader}>
          <View style={styles.manualQuietCopy}>
            <Text style={styles.manualQuietTitle}>手动闭麦范围</Text>
            <Text style={styles.manualQuietText}>
              可同时保留午休、夜间或其他自定义时间段，最多 {MAX_QUIET_HOURS_RANGES} 段。
            </Text>
          </View>
          <Text style={styles.manualQuietCount}>
            {settings.quietHoursRanges.length}/{MAX_QUIET_HOURS_RANGES}
          </Text>
        </View>

        {settings.quietHoursRanges.length === 0 ? (
          <View style={styles.quietEmpty}>
            <Coffee color={colors.textMuted} size={20} strokeWidth={2.3} />
            <Text style={styles.quietEmptyText}>现在全天都能收到小暗号。想午休不被打扰，可以先加一段。</Text>
          </View>
        ) : (
          <View style={styles.rangeList}>
            {settings.quietHoursRanges.map((range, index) => (
              <QuietRangeEditor
                key={range.id}
                index={index}
                onMove={(field, deltaMinutes) => {
                  moveQuietRangeTime(range.id, field, deltaMinutes);
                }}
                onRemove={() => {
                  removeQuietRange(range.id);
                }}
                range={range}
              />
            ))}
          </View>
        )}

        <View style={styles.addRangeRow}>
          <Pressable
            onPress={() => {
              addQuietRange({
                end: DEFAULT_LUNCH_QUIET_HOURS_END,
                id: `lunch-${Date.now()}`,
                start: DEFAULT_LUNCH_QUIET_HOURS_START,
              });
            }}
            accessibilityRole="button"
            disabled={settings.quietHoursRanges.length >= MAX_QUIET_HOURS_RANGES}
            style={({ pressed }) => [
              styles.addRangeButton,
              settings.quietHoursRanges.length >= MAX_QUIET_HOURS_RANGES && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Coffee color={colors.primaryPressed} size={17} strokeWidth={2.4} />
            <Text style={styles.addRangeText}>加午休</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              addQuietRange({
                end: '22:00',
                id: `custom-${Date.now()}`,
                start: '21:00',
              });
            }}
            accessibilityRole="button"
            disabled={settings.quietHoursRanges.length >= MAX_QUIET_HOURS_RANGES}
            style={({ pressed }) => [
              styles.addRangeButton,
              settings.quietHoursRanges.length >= MAX_QUIET_HOURS_RANGES && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Plus color={colors.primaryPressed} size={17} strokeWidth={2.4} />
            <Text style={styles.addRangeText}>加一段</Text>
          </Pressable>
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

type QuietRangeEditorProps = {
  index: number;
  onMove: (field: 'end' | 'start', deltaMinutes: number) => void;
  onRemove: () => void;
  range: QuietHoursRange;
};

function QuietRangeEditor({ index, onMove, onRemove, range }: QuietRangeEditorProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.rangeEditor}>
      <View style={styles.rangeEditorHeader}>
        <View style={styles.rangeTitleRow}>
          <View style={styles.rangeTitleIcon}>
            <Clock3 color={colors.primaryPressed} size={17} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.rangeTitle}>{getRangeTitle(range, index)}</Text>
            <Text style={styles.rangeSubTitle}>{formatRange(range)}</Text>
          </View>
        </View>
        <Pressable
          onPress={onRemove}
          accessibilityLabel={`删除${getRangeTitle(range, index)}`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.removeRangeButton, pressed && styles.pressed]}
        >
          <Trash2 color={colors.textMuted} size={17} strokeWidth={2.3} />
        </Pressable>
      </View>

      <View style={styles.timeRows}>
        <TimeAdjustRow
          label="开始"
          onDecrease={() => {
            onMove('start', -15);
          }}
          onIncrease={() => {
            onMove('start', 15);
          }}
          value={range.start}
        />
        <TimeAdjustRow
          label="结束"
          onDecrease={() => {
            onMove('end', -15);
          }}
          onIncrease={() => {
            onMove('end', 15);
          }}
          value={range.end}
        />
      </View>
    </View>
  );
}

type TimeAdjustRowProps = {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: string;
};

function TimeAdjustRow({ label, onDecrease, onIncrease, value }: TimeAdjustRowProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeRowLabel}>{label}</Text>
      <View style={styles.timeStepper}>
        <Pressable
          onPress={onDecrease}
          accessibilityLabel={`${label}时间提前 15 分钟`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
        >
          <Minus color={colors.textMuted} size={15} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.timeValue}>{value}</Text>
        <Pressable
          onPress={onIncrease}
          accessibilityLabel={`${label}时间推后 15 分钟`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
        >
          <Plus color={colors.textMuted} size={15} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

function areQuietRangesEqual(left: readonly QuietHoursRange[], right: readonly QuietHoursRange[]): boolean {
  const normalizedLeft = normalizeComparableRanges(left);
  const normalizedRight = normalizeComparableRanges(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((range, index) => {
    const rightRange = normalizedRight[index];
    return range.start === rightRange.start && range.end === rightRange.end;
  });
}

function normalizeComparableRanges(ranges: readonly QuietHoursRange[]) {
  return ranges
    .map((range) => ({
      end: range.end,
      start: range.start,
    }))
    .sort((a, b) => (parseTimeToMinutes(a.start) ?? 0) - (parseTimeToMinutes(b.start) ?? 0));
}

function formatRange(range: QuietHoursRange): string {
  return `${range.start} - ${range.end}`;
}

function addMinutesToTime(time: string, deltaMinutes: number): string {
  const currentMinutes = parseTimeToMinutes(time) ?? 0;
  const nextMinutes = (currentMinutes + deltaMinutes + 24 * 60) % (24 * 60);
  const hours = Math.floor(nextMinutes / 60).toString().padStart(2, '0');
  const minutes = (nextMinutes % 60).toString().padStart(2, '0');

  return `${hours}:${minutes}`;
}

function getRangeTitle(range: QuietHoursRange, index: number): string {
  if (range.start === DEFAULT_LUNCH_QUIET_HOURS_START && range.end === DEFAULT_LUNCH_QUIET_HOURS_END) {
    return '午休闭麦';
  }

  if (range.start === DEFAULT_QUIET_HOURS_START && range.end === DEFAULT_QUIET_HOURS_END) {
    return '夜间闭麦';
  }

  return `闭麦 ${index + 1}`;
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
      marginBottom: 4,
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
    manualQuietHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 22,
    },
    manualQuietCopy: {
      flex: 1,
    },
    manualQuietTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 5,
    },
    manualQuietText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    manualQuietCount: {
      color: colors.primaryPressed,
      fontSize: 12,
      fontWeight: '900',
      marginLeft: 12,
      marginTop: 2,
    },
    quietEmpty: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: 14,
      padding: 14,
    },
    quietEmptyText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginLeft: 10,
    },
    rangeList: {
      gap: 10,
      marginTop: 14,
    },
    rangeEditor: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      padding: 13,
    },
    rangeEditorHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    rangeTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flex: 1,
    },
    rangeTitleIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      marginRight: 10,
      width: 30,
    },
    rangeTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 3,
    },
    rangeSubTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    removeRangeButton: {
      alignItems: 'center',
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    timeRows: {
      gap: 8,
    },
    timeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    timeRowLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    timeStepper: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 34,
      paddingHorizontal: 4,
    },
    timeButton: {
      alignItems: 'center',
      borderRadius: 13,
      height: 26,
      justifyContent: 'center',
      width: 28,
    },
    timeValue: {
      color: colors.text,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      minWidth: 48,
      textAlign: 'center',
    },
    addRangeRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    addRangeButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 42,
    },
    addRangeText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '900',
      marginLeft: 6,
    },
    disabledButton: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.82,
    },
  });
}
