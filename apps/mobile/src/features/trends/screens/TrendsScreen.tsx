import { SummaryTile, WeeklyReportCard } from '../sections/TrendsSections';
import { createStyles } from '../styles/trendsStyles';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChartNoAxesColumnIncreasing } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { defaultProStatus, isProStatus } from '../../../features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../../features/account/accountQueries';
import { useHabitStore } from '../../../features/habits/habitStore';
import { useAdvancedReportQuery } from '../../../features/reports/reportQueries';
import { useToiletStore } from '../../../features/toilet/toiletStore';
import { useTrainingStore } from '../../../features/training/trainingStore';
import {
  buildSevenDayTrend,
  buildThirtyDaySummary,
  getTrendPositiveFeedback,
} from '../../../features/trends/trendLogic';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';

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
            {advancedReport?.summaries['90d'].hasAnyRecord ? (
              <View style={styles.summaryGrid}>
                <SummaryTile
                  label="小花训练达标"
                  tone="primary"
                  value={`${advancedReport.summaries['90d'].trainingDays} 天`}
                />
                <SummaryTile
                  label="小账本满格"
                  tone="primary"
                  value={`${advancedReport.summaries['90d'].habitFullDays} 天`}
                />
                <SummaryTile
                  label="蹲会儿长会"
                  tone="warning"
                  value={`${advancedReport.summaries['90d'].toiletLongMeetingCount} 次`}
                />
                <SummaryTile label="有记录" tone="primary" value={`${advancedReport.summaries['90d'].recordDays} 天`} />
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
