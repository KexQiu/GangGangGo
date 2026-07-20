import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, BookOpenCheck, Hourglass } from 'lucide-react-native';

import { AppCard } from '../../../components/AppCard';
import { FlowerLiftIcon } from '../../training/FlowerLiftIcon';
import type { DailyTrend, SevenDayTrend } from '../trendLogic';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/trendsStyles';

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type BarTone = 'danger' | 'info' | 'muted' | 'primary' | 'warning';

export function WeeklyReportCard({ trend }: { trend: SevenDayTrend }) {
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

export function SummaryTile({ label, tone, value }: SummaryTileProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.summaryTile, { borderColor: getBarColor(colors, tone) }]}>
      <Text style={[styles.summaryValue, { color: getBarColor(colors, tone) }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

type OverviewMetricProps = {
  label: string;
  status: string;
  value: string;
};

export function OverviewMetric({ label, status, value }: OverviewMetricProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.todayMetric}>
      <Text style={styles.todayMetricValue}>{value}</Text>
      <Text style={styles.todayMetricLabel}>{label}</Text>
      <Text style={styles.todayMetricTag}>{status}</Text>
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
