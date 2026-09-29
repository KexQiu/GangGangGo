import { QuietRangeEditor, SegmentOption, SettingHeader } from '../sections/ReminderSections';
import { areQuietRangesEqual, formatRange } from '../reminderPresentation';
import { kegelReminderCounts, quietOptions } from '../reminderPresets';
import { useReminderScreen } from '../hooks/useReminderScreen';
import { createStyles } from '../styles/remindersStyles';
import { Bell, BellRing, Check, Coffee, Moon, PersonStanding, Plus, ShieldCheck } from 'lucide-react-native';
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
    nextReminderAt,
    syncSchedule,
    updateSettings,
  } = useReminderScreen();

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.settings} title="提醒设置" />

      <PageHeader subtitle="安排训练和起身提醒，选择通知文案与勿扰时段。" title="提醒小秘书" />

      <AppCard muted style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <BellRing color={colors.privacy} size={28} strokeWidth={2.4} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>
            {isSyncing
              ? '正在校准提醒…'
              : error
                ? '提醒需要重试'
                : needsPermission
                  ? '等待系统通知权限'
                  : scheduledCount > 0
                    ? '每日提醒已安排'
                    : '暂无已安排的提醒'}
          </Text>
          <Text style={styles.summaryText}>
            {nextReminderAt && permissionStatus === 'granted' && !isSyncing && !error
              ? `下次预计 ${new Date(nextReminderAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}，每天重复 ${scheduledCount} 个时段。`
              : '开启提醒并允许系统通知后，这里会显示已安排的下一次时间。'}
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
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
          <AppButton disabled={isSyncing} onPress={() => void syncSchedule()} variant="secondary">
            重试安排
          </AppButton>
        </AppCard>
      ) : null}

      <Text style={styles.groupTitle}>菊花抬提醒</Text>
      <AppCard style={styles.settingsCard}>
        <SettingHeader
          description="菊花抬是盆底肌收缩与放松练习。提醒频率不等于适合个人的训练量。"
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
          description="每天 09:00–21:00，按固定时段提醒；每段可提醒时间开始后，间隔指定分钟再发出。"
          icon={PersonStanding}
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

      <Text style={styles.fieldNote}>
        提醒每天重复，无需每天打开 App。系统专注模式、省电或通知权限可能影响实际送达；回到 App 时会重新校准。
      </Text>

      <Text style={styles.groupTitle}>隐私和勿扰</Text>
      <AppCard style={styles.settingsCard}>
        <SettingHeader
          description="仅训练和久坐提醒使用含蓄文案；不影响好友通知、蹲会儿提醒、锁屏或灵动岛内容。"
          icon={Bell}
          onValueChange={(enabled) => {
            void updateSettings({ privacyMode: enabled });
          }}
          title="训练与久坐通知暗号"
          value={settings.privacyMode}
        />

        <View style={styles.divider} />

        <View style={styles.quietHeader}>
          <View style={styles.quietIcon}>
            <Moon color={colors.info} size={20} strokeWidth={2.3} />
          </View>
          <View style={styles.quietCopy}>
            <Text style={styles.quietTitle}>勿扰时段</Text>
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
            <Text style={styles.manualQuietTitle}>自定义勿扰时段</Text>
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
            <Text style={styles.quietEmptyText}>当前没有额外勿扰限制；久坐提醒仍仅在 09:00–21:00 安排。</Text>
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
