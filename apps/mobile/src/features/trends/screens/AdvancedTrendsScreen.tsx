import { useFocusEffect, useRouter } from 'expo-router';
import { BookOpenCheck, ChartNoAxesColumnIncreasing, Crown, Hourglass, RefreshCw } from 'lucide-react-native';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PageHeader } from '../../../components/PageHeader';
import { PageSection, PageStack } from '../../../components/PageStack';
import { Screen } from '../../../components/Screen';
import { defaultProStatus, isProStatus } from '../../account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../account/accountQueries';
import { useAdvancedReportQuery } from '../../reports/reportQueries';
import { routes } from '../../../navigation/routes';
import { useAppTheme } from '../../../theme/themeProvider';
import { formatReportRange } from '../advancedReportPresentation';
import { ReportCalendarGrid } from '../sections/AdvancedCalendarSection';
import { InsightCard, LegendDot, SummaryTile } from '../sections/AdvancedSummarySections';
import { createStyles } from '../styles/advancedTrendsStyles';

export default function AdvancedReportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const user = useCurrentUserQuery().data;
  const isPro = isProStatus(proStatus);
  const {
    data: advancedReport,
    isFetching: isLoading,
    refetch: refetchAdvancedReport,
  } = useAdvancedReportQuery({ enabled: isPro });

  useFocusEffect(
    useCallback(() => {
      if (isPro) void refetchAdvancedReport();
    }, [isPro, refetchAdvancedReport]),
  );

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.trends} title="90 天回看" />
      <PageHeader
        subtitle="看更长周期的低敏趋势，不做排名，也不做健康评分。"
        title="90 天节奏慢慢看"
      />

      <PageStack gap="regular">
        {!user ? (
          <AppCard style={styles.noticeCard}>
            <Crown color={colors.primaryPressed} size={28} strokeWidth={2.4} />
            <Text style={styles.noticeTitle}>先登录小提督</Text>
            <Text style={styles.noticeBody}>登录后才能刷新云端摘要和查看 Pro 高级小报告。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去登录</AppButton>
          </AppCard>
        ) : null}

        {user && !isPro ? (
          <AppCard style={styles.noticeCard}>
            <Crown color={colors.primaryPressed} size={28} strokeWidth={2.4} />
            <Text style={styles.noticeTitle}>90 天回看在 Pro 里</Text>
            <Text style={styles.noticeBody}>基础小报告继续免费。Pro 会补上更长周期，但仍只使用低敏摘要。</Text>
            <AppButton onPress={() => router.push(routes.pro)}>了解 Pro</AppButton>
          </AppCard>
        ) : null}

        {user && isPro ? (
          <>
            <AppCard muted style={styles.headerCard}>
              <View style={styles.headerTopRow}>
                <View style={styles.headerBadge}>
                  <ChartNoAxesColumnIncreasing color={colors.primaryPressed} size={15} strokeWidth={2.5} />
                  <Text style={styles.headerBadgeText}>Pro 90 天</Text>
                </View>
                <View style={styles.headerStatus}>
                  <RefreshCw color={isLoading ? colors.primary : colors.textSubtle} size={15} strokeWidth={2.4} />
                  <Text style={[styles.headerStatusText, isLoading ? styles.headerStatusTextActive : null]}>
                    {isLoading ? '刷新中' : '低敏摘要'}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerTitle}>
                {advancedReport ? formatReportRange(advancedReport) : '正在准备 90 天数据'}
              </Text>
              <Text style={styles.headerBody}>
                {isLoading ? '正在同步本机低敏日报，再读取云端回看。' : '数据来自本机低敏日报，云端只保存聚合结果。'}
              </Text>
            </AppCard>

            {!advancedReport && isLoading ? (
              <AppCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>90 天摘要刷新中...</Text>
                <Text style={styles.noticeBody}>正在先同步本机低敏日报，再读取云端 90 天回看。</Text>
              </AppCard>
            ) : advancedReport?.summaries['90d'].hasAnyRecord ? (
              <>
                <View style={styles.summaryGrid}>
                  <SummaryTile
                    icon={ChartNoAxesColumnIncreasing}
                    label="小花训练达标"
                    tone="primary"
                    value={`${advancedReport.summaries['90d'].trainingDays} 天`}
                  />
                  <SummaryTile
                    icon={BookOpenCheck}
                    label="小账本满格"
                    tone="primary"
                    value={`${advancedReport.summaries['90d'].habitFullDays} 天`}
                  />
                  <SummaryTile
                    icon={Hourglass}
                    label="蹲会儿长会"
                    tone="warning"
                    value={`${advancedReport.summaries['90d'].toiletLongMeetingCount} 次`}
                  />
                  <SummaryTile
                    icon={RefreshCw}
                    label="有记录"
                    tone="info"
                    value={`${advancedReport.summaries['90d'].recordDays} 天`}
                  />
                </View>

                <PageSection subtitle="按月份看每天的小状态，点点只代表低敏记录。" title="90 天节奏图">
                  <AppCard style={styles.calendarCard}>
                    <ReportCalendarGrid days={advancedReport.days} />
                    <View style={styles.legendRow}>
                      <LegendDot color={colors.primary} label="菊花抬" />
                      <LegendDot color={colors.info} label="小账本" />
                      <LegendDot color={colors.warning} label="蹲会儿" />
                    </View>
                  </AppCard>
                </PageSection>

                <PageSection title="这段时间的线索">
                  <InsightCard report={advancedReport} />
                </PageSection>
              </>
            ) : (
              <AppCard style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>90 天还在等第一笔</Text>
                <Text style={styles.noticeBody}>
                  完成今天的本地记录后会自动同步。这里不会上传便血、不适、排便感受或具体蹲会儿时长。
                </Text>
              </AppCard>
            )}
          </>
        ) : null}
      </PageStack>
    </Screen>
  );
}
