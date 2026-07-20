import { QuietRangeEditor, SegmentOption, SettingHeader } from '../sections/ReminderSections';
import { areQuietRangesEqual, formatRange } from '../reminderPresentation';
import { kegelReminderCounts, quietOptions } from '../reminderPresets';
import { useReminderScreen } from '../hooks/useReminderScreen';
import { createStyles } from '../styles/remindersStyles';
import { Bell, BellRing, Check, Coffee, Moon, Move, Plus, ShieldCheck } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import {
  DEFAULT_LUNCH_QUIET_HOURS_END,
  DEFAULT_LUNCH_QUIET_HOURS_START,
  getKegelTimesForCount,
  getQuietHoursLabel,
  MAX_QUIET_HOURS_RANGES,
  SEDENTARY_INTERVAL_OPTIONS,
} from '../../../features/reminders/reminderLogic';
import { FlowerLiftIcon } from '../../../features/training/FlowerLiftIcon';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    addQuietRange,
    applyQuietPreset,
    error,
    isSyncing,
    moveQuietRangeTime,
    needsPermission,
    permissionStatus,
    removeQuietRange,
    requestPermissionAndSync,
    scheduledCount,
    setKegelEnabled,
    setSedentaryEnabled,
    settings,
    summary,
    updateSettings,
  } = useReminderScreen();

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.settings} title="提醒设置" />

      <PageHeader subtitle="通知栏尽量说人话、留面子，不把尴尬词写满屏。" title="提醒小秘书" />

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
