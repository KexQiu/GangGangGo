import { type ComponentType } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  Hourglass,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { useHabitStore } from '../../src/features/habits/habitStore';
import { useToiletStore } from '../../src/features/toilet/toiletStore';
import { FlowerLiftIcon } from '../../src/features/training/FlowerLiftIcon';
import { useTrainingStore } from '../../src/features/training/trainingStore';
import {
  buildSevenDayTrend,
  buildThirtyDaySummary,
  getTrendPositiveFeedback,
  type DailyTrend,
} from '../../src/features/trends/trendLogic';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrendsScreen() {
  const habitCheckIns = useHabitStore((state) => state.checkIns);
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
          <TrendCard
            days={sevenDayTrend.days}
            getBarTone={(day) => (day.trainingCompletedCount > 0 ? 'primary' : 'muted')}
            getValue={(day) => day.trainingCompletedCount}
            maxValue={2}
            metricLabel="营业组数"
            subtitle={`这周小花营业 ${sevenDayTrend.trainingActiveDays} 天`}
            title="菊花抬"
            icon={FlowerLiftIcon}
          />
          <TrendCard
            days={sevenDayTrend.days}
            getBarTone={(day) => (day.habitFull ? 'primary' : day.habitCompletion > 0 ? 'info' : 'muted')}
            getValue={(day) => day.habitCompletion}
            maxValue={4}
            metricLabel="小账本项数"
            subtitle={`小账本满格 ${sevenDayTrend.habitFullDays} 天`}
            title="小账本"
            icon={BookOpenCheck}
          />
          <TrendCard
            days={sevenDayTrend.days}
            getBarTone={(day) => (day.redFlagCount > 0 ? 'danger' : day.longToiletCount > 0 ? 'warning' : day.toiletSessionCount > 0 ? 'info' : 'muted')}
            getValue={(day) => Math.min(1, day.toiletSessionCount)}
            maxValue={1}
            metricLabel="是否记过"
            subtitle={
              sevenDayTrend.longToiletCount > 0
                ? `蹲会儿长会 ${sevenDayTrend.longToiletCount} 次，知道就好，下次早点散会`
                : '没有蹲会儿长会，收工节奏挺利索'
            }
            title="蹲会儿记录"
            icon={Hourglass}
          />
        </>
      )}

      <Text style={styles.sectionTitle}>近 30 天回看</Text>
      <View style={styles.summaryGrid}>
        <SummaryTile label="小花营业" tone="primary" value={`${thirtyDaySummary.trainingActiveDays} 天`} />
        <SummaryTile label="小账本满格" tone="primary" value={`${thirtyDaySummary.habitFullDays} 天`} />
        <SummaryTile label="蹲会儿长会" tone="warning" value={`${thirtyDaySummary.longToiletCount} 次`} />
        <SummaryTile label="小信号" tone="danger" value={`${thirtyDaySummary.redFlagCount} 次`} />
      </View>

      {thirtyDaySummary.redFlagCount > 0 ? (
        <AppCard style={styles.riskCard}>
          <AlertTriangle color={colors.danger} size={22} strokeWidth={2.4} />
          <Text style={styles.riskText}>近 30 天出现过需要留意的小信号。小报告只负责帮你记住；明显便血、不适加重或剧烈疼痛时，建议咨询医生。</Text>
        </AppCard>
      ) : null}
    </Screen>
  );
}

type TrendCardProps = {
  days: DailyTrend[];
  getBarTone: (day: DailyTrend) => BarTone;
  getValue: (day: DailyTrend) => number;
  icon: IconComponent;
  maxValue: number;
  metricLabel: string;
  subtitle: string;
  title: string;
};

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type BarTone = 'danger' | 'info' | 'muted' | 'primary' | 'warning';

function TrendCard({ days, getBarTone, getValue, icon: Icon, maxValue, metricLabel, subtitle, title }: TrendCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <AppCard style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendIcon}>
          <Icon color={colors.primaryPressed} size={21} strokeWidth={2.4} />
        </View>
        <View style={styles.trendCopy}>
          <Text style={styles.trendTitle}>{title}</Text>
          <Text style={styles.mutedText}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.chartRow}>
        {days.map((day) => {
          const value = getValue(day);
          const normalizedValue = maxValue <= 0 ? 0 : Math.min(1, value / maxValue);
          const barHeight = 12 + normalizedValue * 54;

          return (
            <View key={day.dateKey} style={styles.dayColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: getBarColor(colors, getBarTone(day)),
                      height: barHeight,
                    },
                  ]}
                />
              </View>
              <Text style={styles.dayValue}>{value}</Text>
              <Text numberOfLines={1} style={styles.dayLabel}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.metricLabel}>{metricLabel}</Text>
    </AppCard>
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
    trendCard: {
      marginBottom: 14,
      padding: 18,
    },
    trendHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    trendIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 19,
      height: 38,
      justifyContent: 'center',
      marginRight: 12,
      width: 38,
    },
    trendCopy: {
      flex: 1,
    },
    trendTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 5,
    },
    chartRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    dayColumn: {
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    barTrack: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      height: 72,
      justifyContent: 'flex-end',
      marginBottom: 8,
      overflow: 'hidden',
      width: '100%',
    },
    barFill: {
      borderRadius: 999,
      minHeight: 4,
      width: '100%',
    },
    dayValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 4,
    },
    dayLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
      width: '100%',
    },
    metricLabel: {
      color: colors.textSubtle,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 12,
      textAlign: 'right',
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
  });
}
