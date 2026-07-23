import { useLocalSearchParams, useRouter } from 'expo-router';
import { BellRing, ChevronLeft, ChevronRight, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { FriendDataLevel, FriendHistoryDays, FriendSettings, FriendSharedDay } from '@xiaotidu/contracts';

import { AppCard } from '../../../src/components/AppCard';
import { AppSheet } from '../../../src/components/AppSheet';
import { PageSection, PageStack } from '../../../src/components/PageStack';
import { ProfileAvatar } from '../../../src/components/ProfileAvatar';
import { Screen } from '../../../src/components/Screen';
import { FriendDataCalendar } from '../../../src/features/friends/FriendDataCalendar';
import { FriendDataDetailModal } from '../../../src/features/friends/FriendDataDetailModal';
import {
  useDeleteFriendMutation,
  useFriendDataQuery,
  useFriendQuery,
  useUpdateFriendSettingsMutation,
} from '../../../src/features/friends/friendQueries';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

const dataLevels: Array<{ label: string; value: FriendDataLevel }> = [
  { label: '不可见', value: 'none' },
  { label: '低敏', value: 'summary' },
  { label: '完整', value: 'detailed' },
];
const historyDays: FriendHistoryDays[] = [1, 7, 30];
const nudgeLimits: FriendSettings['nudgeDailyLimit'][] = [0, 3, 5, 8];

type PermissionField = 'habitLevel' | 'toiletLevel' | 'trainingLevel';

const permissionItems: Array<{
  description: string;
  field: PermissionField;
  title: string;
}> = [
  { description: '是否达标，或完整次数与训练时长。', field: 'trainingLevel', title: '菊花抬' },
  { description: '完成度与连续天数，或四项习惯等级。', field: 'habitLevel', title: '小账本' },
  { description: '是否记录，或完整时长与感受明细。', field: 'toiletLevel', title: '蹲会儿' },
];

export default function FriendDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const friendUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const friendQuery = useFriendQuery(friendUserId);
  const dataQuery = useFriendDataQuery(friendUserId);
  const updateSettings = useUpdateFriendSettingsMutation(friendUserId);
  const deleteFriend = useDeleteFriendMutation(friendUserId);
  const detail = friendQuery.data?.friend;
  const mySettings = detail?.mySettings;
  const name = detail?.friend.nickname ?? '好友';
  const sharedDays = dataQuery.data?.days;
  const today = sharedDays?.at(-1) ?? null;
  const [isNotificationSheetOpen, setIsNotificationSheetOpen] = useState(false);
  const [isPrivacySheetOpen, setIsPrivacySheetOpen] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const selectedHistoryDay = useMemo(
    () => sharedDays?.find((day) => day.date === selectedHistoryDate) ?? null,
    [selectedHistoryDate, sharedDays],
  );

  useEffect(() => {
    if (selectedHistoryDate && !selectedHistoryDay) setSelectedHistoryDate(null);
  }, [selectedHistoryDate, selectedHistoryDay]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(routes.friends);
  }

  function updateDataLevel(field: PermissionField, value: FriendDataLevel) {
    if (field === 'trainingLevel') updateSettings.mutate({ trainingLevel: value });
    if (field === 'habitLevel') updateSettings.mutate({ habitLevel: value });
    if (field === 'toiletLevel') updateSettings.mutate({ toiletLevel: value });
  }

  function removeFriend() {
    Alert.alert('删除这个好友？', '双方关系、权限设置和全部互动历史都会永久清除。', [
      { style: 'cancel', text: '取消' },
      {
        onPress: () => deleteFriend.mutate(undefined, { onSuccess: () => router.replace(routes.friends) }),
        style: 'destructive',
        text: '删除好友',
      },
    ]);
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.profileHero}>
        <Pressable
          accessibilityLabel="返回好友列表"
          accessibilityRole="button"
          onPress={goBack}
          style={styles.backButton}
        >
          <ChevronLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.identity}>
          <ProfileAvatar avatarUrl={detail?.friend.avatarUrl ?? null} nickname={name} size="lg" />
          <View style={styles.identityCopy}>
            <Text numberOfLines={1} style={styles.profileName}>
              {name}
            </Text>
            {mySettings ? (
              <View style={styles.accessPill}>
                <View style={styles.accessDot} />
                <Text style={styles.accessText}>{sharingSummary(mySettings)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <PageStack gap="loose">
        <PageSection title="今日状态">
          <AppCard style={styles.todayCard}>
            {today ? (
              <TodayStatus day={today} />
            ) : (
              <Text style={styles.description}>TA 尚未授权数据，或数据还没有同步。</Text>
            )}
          </AppCard>
        </PageSection>

        {sharedDays?.length ? (
          <PageSection
            subtitle={`可查看 TA 授权的近 ${dataQuery.data?.historyDays ?? sharedDays.length} 天数据。`}
            title="历史数据"
          >
            <FriendDataCalendar
              days={sharedDays}
              onSelectDate={setSelectedHistoryDate}
              selectedDate={selectedHistoryDate ?? undefined}
            />
            <Text style={styles.calendarHint}>点选日期，在数据日志中查看当天授权详情。</Text>
          </PageSection>
        ) : null}

        {mySettings ? (
          <PageSection title="关系设置">
            <AppCard style={styles.settingsCard}>
              <SettingsEntry
                detail={sharingSummary(mySettings)}
                icon={ShieldCheck}
                onPress={() => setIsPrivacySheetOpen(true)}
                title="数据共享权限"
              />
              <View style={styles.settingDivider} />
              <SettingsEntry
                detail={notificationSummary(mySettings)}
                icon={BellRing}
                onPress={() => setIsNotificationSheetOpen(true)}
                title="提醒和通知"
              />
              <View style={styles.settingDivider} />
              <SettingsEntry danger icon={Trash2} onPress={removeFriend} title="删除好友" />
            </AppCard>
          </PageSection>
        ) : null}

        {friendQuery.isFetching || dataQuery.isFetching ? <Text style={styles.loading}>好友数据同步中...</Text> : null}
        {friendQuery.error ? <Text style={styles.error}>{friendQuery.error.message}</Text> : null}
        {dataQuery.error ? <Text style={styles.error}>{dataQuery.error.message}</Text> : null}
      </PageStack>

      {mySettings ? (
        <DataPrivacySheet
          isPending={updateSettings.isPending}
          onClose={() => setIsPrivacySheetOpen(false)}
          onDataLevelChange={updateDataLevel}
          onHistoryDaysChange={(historyDaysValue) => updateSettings.mutate({ historyDays: historyDaysValue })}
          settings={mySettings}
          visible={isPrivacySheetOpen}
        />
      ) : null}
      {mySettings ? (
        <NotificationSettingsSheet
          isPending={updateSettings.isPending}
          onClose={() => setIsNotificationSheetOpen(false)}
          onUpdate={(input) => updateSettings.mutate(input)}
          settings={mySettings}
          visible={isNotificationSheetOpen}
        />
      ) : null}
      <FriendDataDetailModal day={selectedHistoryDay} onClose={() => setSelectedHistoryDate(null)} />
    </Screen>
  );
}

function SettingsEntry({
  danger = false,
  detail,
  icon: Icon,
  onPress,
  title,
}: {
  danger?: boolean;
  detail?: string;
  icon: typeof ShieldCheck;
  onPress: () => void;
  title: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const iconColor = danger ? colors.danger : colors.privacy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.settingsEntry, pressed && styles.pressed]}
    >
      <View style={[styles.entryIcon, danger ? styles.entryIconDanger : null]}>
        <Icon color={iconColor} size={18} strokeWidth={2.4} />
      </View>
      <View style={styles.entryCopy}>
        <Text style={[styles.entryTitle, danger ? styles.entryTitleDanger : null]}>{title}</Text>
        {detail ? (
          <Text numberOfLines={1} style={styles.entryDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={danger ? colors.danger : colors.textSubtle} size={18} strokeWidth={2.4} />
    </Pressable>
  );
}

function DataPrivacySheet({
  isPending,
  onClose,
  onDataLevelChange,
  onHistoryDaysChange,
  settings,
  visible,
}: {
  isPending: boolean;
  onClose: () => void;
  onDataLevelChange: (field: PermissionField, value: FriendDataLevel) => void;
  onHistoryDaysChange: (value: FriendHistoryDays) => void;
  settings: FriendSettings;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <AppSheet
      accessibilityLabel="关闭数据共享权限"
      eyebrow="只影响这一位好友"
      onClose={onClose}
      subtitle="未授权字段不会同步给 TA。"
      title="数据共享权限"
      visible={visible}
    >
      <View style={styles.sheetNote}>
        <SlidersHorizontal color={colors.privacy} size={18} strokeWidth={2.4} />
        <Text style={styles.sheetNoteText}>低敏只提供状态概览；完整模式才包含具体次数、时长或等级。</Text>
      </View>

      {permissionItems.map((item) => (
        <View key={item.field} style={styles.permissionControl}>
          <View style={styles.permissionHeader}>
            <View>
              <Text style={styles.permissionTitle}>{item.title}</Text>
              <Text style={styles.permissionDescription}>{item.description}</Text>
            </View>
            <Text style={styles.permissionCurrent}>{dataLevelLabel(settings[item.field])}</Text>
          </View>
          <View style={styles.choiceRow}>
            {dataLevels.map((level) => (
              <ChoiceButton
                disabled={isPending}
                key={level.value}
                label={level.label}
                onPress={() => onDataLevelChange(item.field, level.value)}
                selected={settings[item.field] === level.value}
              />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.historyControl}>
        <View>
          <Text style={styles.permissionTitle}>历史可见范围</Text>
          <Text style={styles.permissionDescription}>TA 只能查看该范围内你授权的数据。</Text>
        </View>
        <View style={styles.choiceRow}>
          {historyDays.map((days) => (
            <ChoiceButton
              disabled={isPending}
              key={days}
              label={historyDaysLabel(days)}
              onPress={() => onHistoryDaysChange(days)}
              selected={settings.historyDays === days}
            />
          ))}
        </View>
      </View>
    </AppSheet>
  );
}

function NotificationSettingsSheet({
  isPending,
  onClose,
  onUpdate,
  settings,
  visible,
}: {
  isPending: boolean;
  onClose: () => void;
  onUpdate: (input: Partial<FriendSettings>) => void;
  settings: FriendSettings;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <AppSheet
      accessibilityLabel="关闭提醒和通知"
      onClose={onClose}
      subtitle="通知能否送达，需要双方分别同意。"
      title="提醒和通知"
      visible={visible}
    >
      <SettingSwitch
        description="我结束蹲会儿并同步后，通知 TA。"
        disabled={isPending}
        onValueChange={(notifyFriendOnToiletEnd) => onUpdate({ notifyFriendOnToiletEnd })}
        title="我收工时通知 TA"
        value={settings.notifyFriendOnToiletEnd}
      />
      <SettingSwitch
        description="允许 TA 在收工后向我发送通知。"
        disabled={isPending}
        onValueChange={(allowToiletEndNotificationsFromFriend) => onUpdate({ allowToiletEndNotificationsFromFriend })}
        title="允许接收 TA 的通知"
        value={settings.allowToiletEndNotificationsFromFriend}
      />
      <View style={styles.optionControl}>
        <Text style={styles.permissionTitle}>允许 TA 提醒我</Text>
        <Text style={styles.permissionDescription}>关闭后，TA 不能向你发送固定暗号。</Text>
        <SettingSwitch
          compact
          disabled={isPending}
          onValueChange={(nudgesEnabled) => onUpdate({ nudgesEnabled })}
          title={settings.nudgesEnabled ? '已开启好友提醒' : '已关闭好友提醒'}
          value={settings.nudgesEnabled}
        />
      </View>
      <View style={styles.optionControl}>
        <Text style={styles.permissionTitle}>每日上限</Text>
        <View style={styles.choiceRow}>
          {nudgeLimits.map((limit) => (
            <ChoiceButton
              disabled={isPending}
              key={limit}
              label={limit === 0 ? '关闭' : `${limit} 次`}
              onPress={() => onUpdate({ nudgeDailyLimit: limit })}
              selected={settings.nudgeDailyLimit === limit}
            />
          ))}
        </View>
      </View>
      <View style={styles.optionControl}>
        <Text style={styles.permissionTitle}>勿扰时间</Text>
        <View style={styles.choiceRow}>
          <ChoiceButton
            disabled={isPending}
            label="关闭"
            onPress={() => onUpdate({ quietRanges: [] })}
            selected={settings.quietRanges.length === 0}
          />
          <ChoiceButton
            disabled={isPending}
            label="22时至次日8时"
            onPress={() => onUpdate({ quietRanges: [{ end: '08:00', start: '22:00' }] })}
            selected={settings.quietRanges.length > 0}
          />
        </View>
      </View>
    </AppSheet>
  );
}

function ChoiceButton({
  disabled,
  label,
  onPress,
  selected,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        selected ? styles.choiceButtonSelected : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.choiceButtonDisabled : null,
      ]}
    >
      <Text style={[styles.choiceButtonText, selected ? styles.choiceButtonTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function SettingSwitch({
  compact = false,
  description,
  disabled,
  onValueChange,
  title,
  value,
}: {
  compact?: boolean;
  description?: string;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.switchRow, compact ? styles.switchRowCompact : null]}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchTitle}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        disabled={disabled}
        ios_backgroundColor={colors.border}
        onValueChange={onValueChange}
        thumbColor={value ? colors.primary : colors.surface}
        trackColor={{ false: colors.border, true: colors.primarySoft }}
        value={value}
      />
    </View>
  );
}

function TodayStatus({ day }: { day: FriendSharedDay }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.todayStatus}>
      <Text style={styles.dayTitle}>{formatDate(day.date)}</Text>
      <View style={styles.todayMetrics}>
        <TodayMetric
          accent={colors.primary}
          detail={todayTrainingDetail(day)}
          label="菊花抬"
          value={todayTrainingValue(day)}
        />
        <TodayMetric accent={colors.info} detail={todayHabitDetail(day)} label="小账本" value={todayHabitValue(day)} />
        <TodayMetric
          accent={colors.warning}
          detail={todayToiletDetail(day)}
          label="蹲会儿"
          value={todayToiletValue(day)}
        />
      </View>
    </View>
  );
}

function TodayMetric({
  accent,
  detail,
  label,
  value,
}: {
  accent: string;
  detail: string;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.metric}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricDetail}>
        {detail}
      </Text>
    </View>
  );
}

function todayTrainingValue(day: FriendSharedDay) {
  if (day.training.level === 'none') return '未授权';
  if (day.training.level === 'summary') return day.training.trainingDone ? '已达标' : '未达标';
  return `${day.training.completedSessionCount} 次`;
}

function todayTrainingDetail(day: FriendSharedDay) {
  if (day.training.level === 'none') return '等待 TA 授权';
  if (day.training.level === 'summary') return '完成建议量即可达标';
  return `${day.training.completedRepetitions} 下`;
}

function todayHabitValue(day: FriendSharedDay) {
  if (day.habit.level === 'none') return '未授权';
  return `${day.habit.completionCount}/4`;
}

function todayHabitDetail(day: FriendSharedDay) {
  if (day.habit.level === 'none') return '等待 TA 授权';
  return `连续 ${day.habit.streakDays} 天`;
}

function todayToiletValue(day: FriendSharedDay) {
  if (day.toilet.level === 'none') return '未授权';
  if (day.toilet.level === 'summary') return day.toilet.toiletRecorded ? '已记录' : '未记录';
  return `${day.toilet.sessionCount} 次`;
}

function todayToiletDetail(day: FriendSharedDay) {
  if (day.toilet.level === 'none') return '等待 TA 授权';
  if (day.toilet.level === 'summary') return '只显示是否记录';
  return `总计 ${formatMinutes(day.toilet.totalDurationSeconds)}`;
}

function sharingSummary(settings: FriendSettings) {
  const count = [settings.trainingLevel, settings.habitLevel, settings.toiletLevel].filter(
    (level) => level !== 'none',
  ).length;
  return `${count}/3 项共享 · ${historyDaysLabel(settings.historyDays)}`;
}

function notificationSummary(settings: FriendSettings) {
  const toiletNotificationEnabled = settings.notifyFriendOnToiletEnd || settings.allowToiletEndNotificationsFromFriend;
  const nudgesEnabled = settings.nudgesEnabled && settings.nudgeDailyLimit > 0;
  return `蹲会儿${toiletNotificationEnabled ? '已开' : '关闭'} · 提醒${nudgesEnabled ? '已开' : '关闭'}`;
}

function dataLevelLabel(level: FriendDataLevel) {
  return dataLevels.find((item) => item.value === level)?.label ?? '不可见';
}

function historyDaysLabel(days: FriendHistoryDays) {
  return days === 1 ? '仅今天' : `${days} 天`;
}

function formatMinutes(seconds: number) {
  return `${Math.max(0, Math.round(seconds / 60))} 分钟`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('zh-CN', { day: 'numeric', month: 'numeric', weekday: 'short' }).format(date);
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    accessDot: { backgroundColor: colors.primary, borderRadius: 4, height: 7, width: 7 },
    accessPill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.primarySoft,
      borderRadius: 99,
      flexDirection: 'row',
      gap: 6,
      marginTop: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    accessText: { color: colors.primaryPressed, fontSize: 11, fontWeight: '900' },
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    calendarHint: { color: colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 18, paddingHorizontal: 2 },
    choiceButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 7,
    },
    choiceButtonDisabled: { opacity: 0.55 },
    choiceButtonSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    choiceButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
    choiceButtonTextSelected: { color: colors.primaryPressed },
    choiceRow: { flexDirection: 'row', gap: 7 },
    dayTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
    description: { color: colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 18 },
    entryCopy: { flex: 1, gap: 3, minWidth: 0 },
    entryDetail: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    entryIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 13,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    entryIconDanger: { backgroundColor: colors.dangerSoft },
    entryTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    entryTitleDanger: { color: colors.danger },
    error: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    historyControl: { backgroundColor: colors.surfaceMuted, borderRadius: 18, gap: 12, padding: 14 },
    identity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 13, minWidth: 0 },
    identityCopy: { flex: 1, minWidth: 0 },
    loading: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    metric: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      flex: 1,
      gap: 3,
      minWidth: 0,
      overflow: 'hidden',
      padding: 10,
    },
    metricAccent: { borderRadius: 3, height: 4, marginBottom: 3, width: 22 },
    metricDetail: { color: colors.textSubtle, fontSize: 10, fontWeight: '700' },
    metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
    metricValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
    optionControl: { backgroundColor: colors.surfaceMuted, borderRadius: 18, gap: 10, padding: 14 },
    permissionControl: { backgroundColor: colors.surfaceMuted, borderRadius: 18, gap: 12, padding: 14 },
    permissionCurrent: { color: colors.privacy, fontSize: 12, fontWeight: '900' },
    permissionDescription: { color: colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 3 },
    permissionHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
    permissionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
    profileHero: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingBottom: 4, paddingTop: 14 },
    profileName: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
    screen: { paddingTop: 0 },
    settingDivider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginLeft: 64 },
    settingsCard: { overflow: 'hidden', padding: 0 },
    settingsEntry: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 74,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    sheetNote: {
      alignItems: 'flex-start',
      backgroundColor: colors.primarySoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      padding: 13,
    },
    sheetNoteText: { color: colors.textMuted, flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 18 },
    switchCopy: { flex: 1, gap: 3, minWidth: 0 },
    switchRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
    },
    switchRowCompact: {
      backgroundColor: 'transparent',
      borderRadius: 0,
      paddingHorizontal: 0,
      paddingBottom: 0,
      paddingTop: 3,
    },
    switchTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    todayCard: { gap: 13, padding: 15 },
    todayMetrics: { flexDirection: 'row', gap: 8 },
    todayStatus: { gap: 10 },
  });
}
