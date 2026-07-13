import type { AdvancedReportResponse } from '@xiaotidu/contracts';
import { AlertTriangle, ChartNoAxesColumnIncreasing } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Text, View } from 'react-native';

import { AppCard } from '../../../components/AppCard';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/advancedTrendsStyles';

type SummaryTone = 'info' | 'primary' | 'warning';
type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function SummaryTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: IconComponent;
  label: string;
  tone: SummaryTone;
  value: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const color = getToneColor(colors, tone);

  return (
    <View style={[styles.summaryTile, { borderColor: color }]}>
      <View style={styles.summaryTileHeader}>
        <Icon color={color} size={16} strokeWidth={2.4} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

export function InsightCard({ report }: { report: AdvancedReportResponse }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const insight = getInsight(report);

  return (
    <AppCard style={styles.insightCard}>
      {insight.tone === 'warning' ? (
        <AlertTriangle color={colors.warning} size={23} strokeWidth={2.4} />
      ) : (
        <ChartNoAxesColumnIncreasing color={colors.primaryPressed} size={23} strokeWidth={2.4} />
      )}
      <View style={styles.insightCopy}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <Text style={styles.noticeBody}>{insight.body}</Text>
      </View>
    </AppCard>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function getToneColor(colors: ThemeColors, tone: SummaryTone) {
  if (tone === 'warning') return colors.warning;
  if (tone === 'info') return colors.info;
  return colors.primary;
}

function getInsight(report: AdvancedReportResponse) {
  const summary = report.summaries['90d'];
  if (summary.toiletLongMeetingCount >= 3) {
    return {
      body: `90 天里有 ${summary.toiletLongMeetingCount} 次蹲会儿长会。知道就好，下次早点散会，身体不舒服时先看小花说明书。`,
      title: '长会有点多，先留意',
      tone: 'warning' as const,
    };
  }
  if (summary.trainingDays >= 45 && summary.habitFullDays >= 45) {
    return {
      body: '小花训练达标和小账本都保持了不少天，节奏已经很清楚。继续轻轻来就好。',
      title: '90 天节奏很稳',
      tone: 'primary' as const,
    };
  }
  if (summary.trainingDays >= 15 && summary.trainingDays >= summary.habitFullDays) {
    return {
      body: `小花训练达标 ${summary.trainingDays} 天，身体活动这条线已经先跑起来了。`,
      title: '小花有在营业',
      tone: 'primary' as const,
    };
  }
  if (summary.habitFullDays > 0) {
    return {
      body: `小账本满格 ${summary.habitFullDays} 天，习惯线索开始变得完整。`,
      title: '小账本有线索',
      tone: 'primary' as const,
    };
  }
  return {
    body: `90 天里有 ${summary.recordDays} 天留下记录。先不用追求满格，持续出现就算开始。`,
    title: '已经开始有记录',
    tone: 'primary' as const,
  };
}
