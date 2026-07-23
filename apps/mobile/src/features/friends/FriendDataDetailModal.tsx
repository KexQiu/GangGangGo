import { useRef } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';

import type { FriendDataLevel, FriendSharedDay } from '@xiaotidu/contracts';

import { AppSheet } from '../../components/AppSheet';
import { useAppTheme } from '../../theme/themeProvider';

const levelCopy: Record<FriendDataLevel, string> = {
  detailed: '完整数据',
  none: '未授权',
  summary: '低敏概览',
};

const habitLevelCopy = {
  good: '不错',
  low: '偏少',
  medium: '一般',
  null: '未记录',
} as const;

const toiletShapeCopy: Record<string, string> = {
  formed: '成形',
  hard: '偏硬',
  loose: '偏稀',
};

const toiletColorCopy: Record<string, string> = {
  attention: '需要留意',
  normal: '常见颜色',
  other: '其他',
};

const toiletFeelingCopy: Record<string, string> = {
  difficult: '困难',
  normal: '一般',
  smooth: '顺畅',
};

type Props = {
  day: FriendSharedDay | null;
  onClose: () => void;
};

export function FriendDataDetailModal({ day, onClose }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const lastPresentedDay = useRef<FriendSharedDay | null>(day);
  if (day) lastPresentedDay.current = day;
  const displayedDay = day ?? lastPresentedDay.current;

  if (!displayedDay) return null;

  return (
    <AppSheet
      accessibilityLabel="关闭历史数据详情"
      contentContainerStyle={styles.content}
      eyebrow="授权数据日志"
      onClose={onClose}
      subtitle="只展示 TA 在这一天授权给你的信息"
      title={formatDate(displayedDay.date)}
      visible={Boolean(day)}
    >
      {day ? (
        <>
          <View style={styles.privacyNote}>
            <LockKeyhole color={colors.privacy} size={16} strokeWidth={2.4} />
            <Text style={styles.privacyNoteText}>数据权限由 TA 单独设置，未授权字段不会出现在这里。</Text>
          </View>

          <View style={styles.overviewRow}>
            <OverviewItem accent={colors.primary} label="菊花抬" value={trainingOverview(displayedDay)} />
            <OverviewItem accent={colors.info} label="小账本" value={habitOverview(displayedDay)} />
            <OverviewItem accent={colors.warning} label="蹲会儿" value={toiletOverview(displayedDay)} />
          </View>

          <DomainCard accent={colors.primary} level={displayedDay.training.level} title="菊花抬">
            {displayedDay.training.level === 'none' ? (
              <LockedState />
            ) : displayedDay.training.level === 'summary' ? (
              <Text style={styles.summaryCopy}>
                {displayedDay.training.trainingDone ? '今天已完成建议训练量。' : '今天还未完成建议训练量。'}
              </Text>
            ) : (
              <View style={styles.metricRow}>
                <Metric label="完成课程" value={`${displayedDay.training.completedSessionCount} 次`} />
                <Metric label="完成动作" value={`${displayedDay.training.completedRepetitions} 下`} />
                <Metric label="训练时长" value={formatMinutes(displayedDay.training.totalDurationSeconds)} />
              </View>
            )}
          </DomainCard>

          <DomainCard accent={colors.info} level={displayedDay.habit.level} title="小账本">
            {displayedDay.habit.level === 'none' ? (
              <LockedState />
            ) : displayedDay.habit.level === 'summary' ? (
              <View style={styles.summaryMetricRow}>
                <SummaryMetric label="今日完成" value={`${displayedDay.habit.completionCount}/4`} />
                <SummaryMetric label="连续记录" value={`${displayedDay.habit.streakDays} 天`} />
              </View>
            ) : (
              <>
                <View style={styles.summaryMetricRow}>
                  <SummaryMetric label="今日完成" value={`${displayedDay.habit.completionCount}/4`} />
                  <SummaryMetric label="连续记录" value={`${displayedDay.habit.streakDays} 天`} />
                </View>
                <View style={styles.factList}>
                  <FactRow
                    label="饮水"
                    value={habitLevelCopy[String(displayedDay.habit.water) as keyof typeof habitLevelCopy]}
                  />
                  <FactRow
                    label="纤维"
                    value={habitLevelCopy[String(displayedDay.habit.fiber) as keyof typeof habitLevelCopy]}
                  />
                  <FactRow
                    label="活动"
                    value={habitLevelCopy[String(displayedDay.habit.movement) as keyof typeof habitLevelCopy]}
                  />
                  <FactRow
                    label="排便"
                    value={habitLevelCopy[String(displayedDay.habit.bowel) as keyof typeof habitLevelCopy]}
                  />
                </View>
              </>
            )}
          </DomainCard>

          <DomainCard accent={colors.warning} level={displayedDay.toilet.level} title="蹲会儿">
            {displayedDay.toilet.level === 'none' ? (
              <LockedState />
            ) : displayedDay.toilet.level === 'summary' ? (
              <Text style={styles.summaryCopy}>
                {displayedDay.toilet.toiletRecorded ? '今天有完成记录。' : '今天还没有记录。'}
              </Text>
            ) : (
              <>
                <View style={styles.metricRow}>
                  <Metric label="记录次数" value={`${displayedDay.toilet.sessionCount} 次`} />
                  <Metric label="累计时长" value={formatMinutes(displayedDay.toilet.totalDurationSeconds)} />
                  <Metric label="最长一次" value={formatMinutes(displayedDay.toilet.maxDurationSeconds)} />
                </View>
                <View style={styles.noticeRow}>
                  <Text style={styles.noticeText}>较久记录 {displayedDay.toilet.longSessionCount} 次</Text>
                  <View style={styles.noticeDivider} />
                  <Text style={styles.noticeText}>需留意 {displayedDay.toilet.attentionCount} 次</Text>
                </View>
                <DetailTags day={displayedDay} />
              </>
            )}
          </DomainCard>

          <Text style={styles.footer}>请尊重好友的隐私设置，不要转发或截图传播这些健康数据。</Text>
        </>
      ) : null}
    </AppSheet>
  );
}

function OverviewItem({ accent, label, value }: { accent: string; label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.overviewItem}>
      <View style={[styles.overviewDot, { backgroundColor: accent }]} />
      <Text style={styles.overviewValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function DomainCard({
  accent,
  children,
  level,
  title,
}: {
  accent: string;
  children: ReactNode;
  level: FriendDataLevel;
  title: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.domainCard}>
      <View style={[styles.domainAccent, { backgroundColor: accent }]} />
      <View style={styles.domainContent}>
        <View style={styles.domainHeader}>
          <Text style={styles.domainTitle}>{title}</Text>
          <View style={[styles.levelPill, { borderColor: accent }]}>
            <Text style={[styles.levelPillText, { color: accent }]}>{levelCopy[level]}</Text>
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

function LockedState() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.lockedState}>
      <LockKeyhole color={colors.textSubtle} size={15} strokeWidth={2.4} />
      <Text style={styles.lockedText}>TA 暂未授权此项数据</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
      <Text style={styles.summaryMetricValue}>{value}</Text>
    </View>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function DetailTags({ day }: { day: FriendSharedDay }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  if (day.toilet.level !== 'detailed') return null;

  const groups = [
    { entries: countEntries(day.toilet.shapeCounts, toiletShapeCopy), label: '形态' },
    { entries: countEntries(day.toilet.colorCounts, toiletColorCopy), label: '颜色' },
    { entries: countEntries(day.toilet.feelingCounts, toiletFeelingCopy), label: '感受' },
    { entries: countEntries(day.toilet.signalCounts), label: '小信号' },
  ].filter((group) => group.entries.length > 0);

  if (!groups.length) return null;

  return (
    <View style={styles.tagGroups}>
      {groups.map((group) => (
        <View key={group.label} style={styles.tagGroup}>
          <Text style={styles.tagGroupLabel}>{group.label}</Text>
          <View style={styles.tagRow}>
            {group.entries.map((entry) => (
              <View key={entry.label} style={styles.tag}>
                <Text style={styles.tagText}>{entry.count > 1 ? `${entry.label} ×${entry.count}` : entry.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function countEntries(counts: Record<string, number>, labels: Record<string, string> = {}) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ count, label: labels[key] ?? key }));
}

function trainingOverview(day: FriendSharedDay) {
  if (day.training.level === 'none') return '未授权';
  if (day.training.level === 'summary') return day.training.trainingDone ? '已达标' : '未达标';
  return `${day.training.completedSessionCount} 次`;
}

function habitOverview(day: FriendSharedDay) {
  if (day.habit.level === 'none') return '未授权';
  return `${day.habit.completionCount}/4`;
}

function toiletOverview(day: FriendSharedDay) {
  if (day.toilet.level === 'none') return '未授权';
  if (day.toilet.level === 'summary') return day.toilet.toiletRecorded ? '已记录' : '未记录';
  return `${day.toilet.sessionCount} 次`;
}

function formatMinutes(seconds: number) {
  return `${Math.max(0, Math.round(seconds / 60))} 分钟`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { day: 'numeric', month: 'long', weekday: 'long' }).format(
    new Date(`${value}T12:00:00`),
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { gap: 14, paddingBottom: 34, paddingHorizontal: 20 },
    domainAccent: { alignSelf: 'stretch', borderRadius: 4, width: 4 },
    domainCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    domainContent: { flex: 1, gap: 12, padding: 15 },
    domainHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    domainTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    factLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    factList: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 9, paddingTop: 11 },
    factRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    factValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
    footer: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      paddingHorizontal: 4,
      textAlign: 'center',
    },
    levelPill: { borderRadius: 99, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 4 },
    levelPillText: { fontSize: 11, fontWeight: '900' },
    lockedState: { alignItems: 'center', flexDirection: 'row', gap: 7, paddingVertical: 2 },
    lockedText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    metric: { flex: 1, gap: 3, minWidth: 0 },
    metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
    metricRow: { flexDirection: 'row', gap: 8 },
    metricValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
    noticeDivider: { backgroundColor: colors.border, height: 12, width: StyleSheet.hairlineWidth },
    noticeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
    noticeText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    overviewDot: { borderRadius: 4, height: 7, width: 7 },
    overviewItem: { alignItems: 'center', flex: 1, gap: 4, minWidth: 0 },
    overviewLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
    overviewRow: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    overviewValue: { color: colors.text, fontSize: 15, fontWeight: '900' },
    privacyNote: {
      alignItems: 'flex-start',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 9,
      padding: 12,
    },
    privacyNoteText: { color: colors.textMuted, flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 18 },
    summaryCopy: { color: colors.textMuted, fontSize: 13, fontWeight: '700', lineHeight: 20 },
    summaryMetric: { flex: 1, gap: 3 },
    summaryMetricLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    summaryMetricRow: { flexDirection: 'row', gap: 16 },
    summaryMetricValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
    tag: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 99,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    tagGroup: { gap: 6 },
    tagGroupLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '900' },
    tagGroups: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 10, paddingTop: 12 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  });
}
