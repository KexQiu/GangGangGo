import { useRouter } from 'expo-router';
import { type ComponentType } from 'react';
import { AlertTriangle, BookOpenCheck, ChartNoAxesColumnIncreasing, Hourglass } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { defaultProStatus, isProStatus } from '../../src/features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../src/features/account/accountQueries';
import { useHabitStore } from '../../src/features/habits/habitStore';
import { useAdvancedReportQuery } from '../../src/features/reports/reportQueries';
import { useToiletStore } from '../../src/features/toilet/toiletStore';
import { FlowerLiftIcon } from '../../src/features/training/FlowerLiftIcon';
import { useTrainingStore } from '../../src/features/training/trainingStore';
import {
  buildSevenDayTrend,
  buildThirtyDaySummary,
  getTrendPositiveFeedback,
  type DailyTrend,
  type SevenDayTrend,
} from '../../src/features/trends/trendLogic';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrendsScreen() {
  const router = useRouter();
  const habitCheckIns = useHabitStore((state) => state.checkIns);
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const user = useCurrentUserQuery().data;
  const isPro = isProStatus(proStatus);
  const advancedReport = useAdvancedReportQuery({ enabled: isPro }).data;
  const toiletSessions = useToiletStore((state) => state.sessions);
  const trainingSessions = useTrainingStore((state) => state.sessions);
  const trendInput = {
    habitCheckIns,
    toiletSessions,
    trainingSessions,
  };
  const sevenDayTrend = buildSevenDayTrend(trendInput);
  const thirtyDaySummary = buildThirtyDaySummary(trendInput);
  const feedback = getTrendPositiveFeedback(sevenDayTrend);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="最近小报告" />

      <PageHeader
        eyebrow="最近小报告"
        subtitle="看节奏，不卷数字。蹲会儿长会只提醒，不算战绩。"
        title="这周小花表现如何"
      />

      <AppCard muted style={styles.feedbackCard}>
        <View style={styles.feedbackIcon}>
          <ChartNoAxesColumnIncreasing color={colors.primaryPressed} size={25} strokeWidth={2.4} />
        </View>
        <View style={styles.feedbackCopy}>
          <Text style={styles.feedbackTitle}>{feedback.title}</Text>
          <Text style={styles.mutedText}>{feedback.body}</Text>
        </View>
      </AppCard>

      {!sevenDayTrend.hasAnyRecord ? (
        <AppCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>这周还在热身</Text>
          <Text style={styles.mutedText}>做一组菊花抬，或点一下小账本，小报告就有第一笔。</Text>
        </AppCard>
      ) : (
        <>
          <Text style={styles.sectionTitle}>近 7 天小报告</Text>
          <WeeklyReportCard trend={sevenDayTrend} />
        </>
      )}

      <Text style={styles.sectionTitle}>近 30 天回看</Text>
      <View style={styles.summaryGrid}>
        <SummaryTile label="小花训练达标" tone="primary" value={`${thirtyDaySummary.trainingActiveDays} 天`} />
        <SummaryTile label="小账本满格" tone="primary" value={`${thirtyDaySummary.habitFullDays} 天`} />
        <SummaryTile label="蹲会儿长会" tone="warning" value={`${thirtyDaySummary.longToiletCount} 次`} />
        <SummaryTile label="小信号" tone="danger" value={`${thirtyDaySummary.redFlagCount} 次`} />
      </View>

      {thirtyDaySummary.redFlagCount > 0 ? (
        <AppCard style={styles.riskCard}>
          <AlertTriangle color={colors.danger} size={22} strokeWidth={2.4} />
          <Text style={styles.riskText}>
            近 30 天出现过需要留意的小信号。小报告只负责帮你记住；明显便血、不适加重或剧烈疼痛时，建议咨询医生。
          </Text>
        </AppCard>
      ) : null}

      <Text style={styles.sectionTitle}>Pro 高级小报告</Text>
      <AppCard style={styles.proCard}>
        {isPro ? (
          <>
            <Text style={styles.proTitle}>90 天回看</Text>
            {advancedReport?.summary.hasAnyRecord ? (
              <View style={styles.summaryGrid}>
                <SummaryTile label="小花训练达标" tone="primary" value={`${advancedReport.summary.trainingDays} 天`} />
                <SummaryTile label="小账本满格" tone="primary" value={`${advancedReport.summary.habitFullDays} 天`} />
                <SummaryTile
                  label="蹲会儿长会"
                  tone="warning"
                  value={`${advancedReport.summary.toiletLongMeetingCount} 次`}
                />
                <SummaryTile label="有记录" tone="primary" value={`${advancedReport.summary.recordDays} 天`} />
              </View>
            ) : (
              <Text style={styles.mutedText}>高级小报告还在等第一笔云端摘要。完成今天的本地记录后会自动同步。</Text>
            )}
            <AppButton onPress={() => router.push(routes.advancedReport)} style={styles.proButton} variant="secondary">
              查看 90 天回看
            </AppButton>
          </>
        ) : (
          <>
            <Text style={styles.proTitle}>{user ? '解锁 90 天小报告' : '登录后查看 Pro 能力'}</Text>
            <Text style={styles.mutedText}>基础小报告继续免费。Pro 会看更长周期，但仍不上传敏感细节。</Text>
            <AppButton
              onPress={() => router.push(user ? routes.pro : routes.me)}
              style={styles.proButton}
              variant="secondary"
            >
              {user ? '了解 Pro' : '去登录'}
            </AppButton>
          </>
        )}
      </AppCard>
    </Screen>
  );
}

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type BarTone = 'danger' | 'info' | 'muted' | 'primary' | 'warning';

function WeeklyReportCard({ trend }: { trend: SevenDayTrend }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const toiletTone = trend.longToiletCount > 0 || trend.redFlagCount > 0 ? colors.warning : colors.info;
  const recordDays = trend.days.filter(hasTrendDailyRecord).length;
  const completeDays = trend.days.filter(hasCompleteDailyRecord).length;

  return (
    <AppCard style={styles.weeklyCard}>
      <View style={styles.weeklyHero}>
        <View style={styles.weeklyHeroCopy}>
          <Text style={styles.weeklyEyebrow}>{formatWeekRange(trend.days)}</Text>
          <Text style={styles.weeklyTitle}>7 天节奏</Text>
          <Text style={styles.mutedText}>每天三枚点，只看低敏记录有没有出现。</Text>
        </View>
        <View style={styles.weeklyRecordBadge}>
          <Text style={styles.weeklyRecordValue}>{recordDays}/7</Text>
          <Text style={styles.weeklyRecordLabel}>有记录</Text>
        </View>
      </View>

      <View style={styles.weeklySummaryRow}>
        <WeeklySummaryPill
          color={colors.primary}
          icon={FlowerLiftIcon}
          label="小花训练达标"
          value={`${trend.trainingActiveDays} 天`}
        />
        <WeeklySummaryPill
          color={colors.info}
          icon={BookOpenCheck}
          label="小账本满格"
          value={`${trend.habitFullDays} 天`}
        />
        <WeeklySummaryPill
          color={toiletTone}
          icon={Hourglass}
          label="蹲会儿长会"
          value={`${trend.longToiletCount} 次`}
        />
      </View>

      <View style={styles.weekTimeline}>
        {trend.days.map((day) => (
          <WeeklyDayColumn day={day} key={day.dateKey} />
        ))}
      </View>

      <View style={styles.weekLegendRow}>
        <LegendItem color={colors.primary} label="菊花抬" />
        <LegendItem color={colors.info} label="小账本" />
        <LegendItem color={colors.warning} label="蹲会儿" />
      </View>

      {trend.longToiletCount > 0 ? (
        <View style={styles.weekNotice}>
          <AlertTriangle color={colors.warning} size={17} strokeWidth={2.4} />
          <Text style={styles.weekNoticeText}>
            这周有 {trend.longToiletCount} 次蹲会儿长会，知道就好，下次早点散会。
          </Text>
        </View>
      ) : null}

      {completeDays > 0 ? (
        <Text style={styles.weekFootnote}>这周有 {completeDays} 天三项都出现，继续保持这个轻轻的节奏。</Text>
      ) : null}
    </AppCard>
  );
}

function WeeklySummaryPill({
  color,
  icon: Icon,
  label,
  value,
}: {
  color: string;
  icon: IconComponent;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.weeklySummaryPill}>
      <View style={[styles.weeklySummaryIcon, { borderColor: color }]}>
        <Icon color={color} size={15} strokeWidth={2.4} />
      </View>
      <Text style={[styles.weeklySummaryValue, { color }]}>{value}</Text>
      <Text numberOfLines={1} style={styles.weeklySummaryLabel}>
        {label}
      </Text>
    </View>
  );
}

function WeeklyDayColumn({ day }: { day: DailyTrend }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isToday = day.label === '今天';

  return (
    <View style={[styles.weekDayColumn, isToday ? styles.weekDayColumnToday : null]}>
      <Text numberOfLines={1} style={[styles.weekDayLabel, isToday ? styles.weekDayLabelToday : null]}>
        {formatWeekDayLabel(day.label)}
      </Text>
      <View style={styles.weekDaySignalPanel}>
        <WeeklyStatusDot active={day.trainingCompletedCount > 0} color={colors.primary} />
        <WeeklyStatusDot active={day.habitCompletion > 0} color={colors.info} />
        <WeeklyStatusDot active={day.toiletSessionCount > 0} color={colors.warning} />
      </View>
    </View>
  );
}

function WeeklyStatusDot({ active, color }: { active: boolean; color: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return <View style={[styles.weekStatusDot, { backgroundColor: active ? color : colors.border }]} />;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

type SummaryTileProps = {
  label: string;
  tone: Exclude<BarTone, 'info' | 'muted'>;
  value: string;
};

function SummaryTile({ label, tone, value }: SummaryTileProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.summaryTile, { borderColor: getBarColor(colors, tone) }]}>
      <Text style={[styles.summaryValue, { color: getBarColor(colors, tone) }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function getBarColor(colors: ThemeColors, tone: BarTone): string {
  const colorMap = {
    danger: colors.danger,
    info: colors.info,
    muted: colors.border,
    primary: colors.primary,
    warning: colors.warning,
  };

  return colorMap[tone];
}

function formatWeekRange(days: DailyTrend[]) {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  if (!firstDay || !lastDay) {
    return '近 7 天';
  }

  return `${formatDateKeyLabel(firstDay.dateKey)} - ${formatDateKeyLabel(lastDay.dateKey)}`;
}

function formatDateKeyLabel(dateKey: string) {
  const [, month = '', day = ''] = dateKey.split('-');

  return `${Number(month)}. ${Number(day)}`;
}

function formatWeekDayLabel(label: string) {
  return label.replace('/', '. ');
}

function getTrendDailyRecordCount(day: DailyTrend) {
  return [day.trainingCompletedCount > 0, day.habitCompletion > 0, day.toiletSessionCount > 0].filter(Boolean).length;
}

function hasTrendDailyRecord(day: DailyTrend) {
  return getTrendDailyRecordCount(day) > 0;
}

function hasCompleteDailyRecord(day: DailyTrend) {
  return getTrendDailyRecordCount(day) >= 3;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    feedbackCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    feedbackIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      marginRight: 13,
      width: 44,
    },
    feedbackCopy: {
      flex: 1,
    },
    feedbackTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 5,
    },
    mutedText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
    },
    emptyCard: {
      marginBottom: 20,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 6,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
      marginTop: 4,
    },
    legendDot: {
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    summaryTile: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      flexBasis: '47%',
      flexGrow: 1,
      padding: 16,
    },
    summaryValue: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 6,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    riskCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      flexDirection: 'row',
      marginBottom: 16,
    },
    riskText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
    proButton: {
      marginTop: 12,
    },
    proCard: {
      gap: 8,
      marginBottom: 16,
    },
    proTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    weekDayColumn: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexBasis: 0,
      flexGrow: 1,
      gap: 8,
      minWidth: 0,
      paddingHorizontal: 2,
      paddingVertical: 9,
    },
    weekDayColumnToday: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    weekDayLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 13,
      textAlign: 'center',
      width: '100%',
    },
    weekDayLabelToday: {
      color: colors.primaryPressed,
      fontWeight: '900',
    },
    weekDaySignalPanel: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 2,
    },
    weekFootnote: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    weekTimeline: {
      flexDirection: 'row',
      gap: 5,
    },
    weekLegendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    weekNotice: {
      alignItems: 'flex-start',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    weekNoticeText: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    weeklyCard: {
      gap: 16,
      marginBottom: 18,
      padding: 16,
    },
    weeklyEyebrow: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
      marginBottom: 3,
    },
    weeklyHero: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    weeklyHeroCopy: {
      flex: 1,
    },
    weeklyRecordBadge: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 16,
      minWidth: 58,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    weeklyRecordLabel: {
      color: colors.primaryPressed,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 13,
    },
    weeklyRecordValue: {
      color: colors.primaryPressed,
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 20,
    },
    weeklySummaryIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 11,
      borderWidth: 1,
      height: 24,
      justifyContent: 'center',
      width: 24,
    },
    weeklySummaryLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 13,
    },
    weeklySummaryPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      gap: 5,
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 8,
      paddingVertical: 9,
    },
    weeklySummaryRow: {
      flexDirection: 'row',
      gap: 8,
    },
    weeklySummaryValue: {
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 18,
    },
    weeklyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 4,
    },
    weekStatusDot: {
      borderRadius: 5,
      height: 10,
      width: 10,
    },
  });
}
