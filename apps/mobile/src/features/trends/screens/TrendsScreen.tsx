import type { DailyActivitySummary } from '@xiaotidu/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { PageHeader } from '../../../components/PageHeader';
import { AppCard } from '../../../components/AppCard';
import { AppButton } from '../../../components/AppButton';
import { authSessionContext } from '../../../api/sessionContext';
import { LocalReadResource } from '../../../storage/localReadResource';
import { useAuthStore } from '../../account/authStore';
import { Screen } from '../../../components/Screen';
import { useAppTheme } from '../../../theme/themeProvider';
import {
  type DailyDataDetailSection,
  DailyDataCalendar,
  DailyDataDetailModal,
  DataTrendChart,
  TodayDataOverview,
} from '../../data/DataDashboardSections';
import {
  type DailyDataDetails,
  emptyDailySummary,
  getDailyDataDetails,
  listDailyActivitySummaries,
} from '../../data/dailyData';
import { subscribeToLocalDataChanges } from '../../sync/localDataEvents';
import { getLocalDateKey } from '../../habits/habitLogic';
import { createDataStyles } from '../../data/styles/dataStyles';
import { routes } from '../../../navigation/routes';

export default function TrendsScreen() {
  const router = useRouter();
  const [summaryReader] = useState(
    () =>
      new LocalReadResource<DailyActivitySummary[]>((items) =>
        items.every(
          (item) => !item.toilet.sessionCount && !item.training.totalDurationSeconds && !item.habit.completionCount,
        ),
      ),
  );
  const [detailReader] = useState(() => new LocalReadResource<DailyDataDetails>());
  const summaryState = useSyncExternalStore(summaryReader.subscribe, summaryReader.getSnapshot);
  const detailState = useSyncExternalStore(detailReader.subscribe, detailReader.getSnapshot);
  const token = useAuthStore((state) => state.accessToken);
  const authLoading = useAuthStore((state) => state.isLoading || !state.hasHydrated);
  const [activeDate, setActiveDate] = useState(getLocalDateKey);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailSection, setDetailSection] = useState<DailyDataDetailSection | null>(null);
  const [trendGestureActive, setTrendGestureActive] = useState(false);
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) {
        summaryReader.reset();
        detailReader.reset();
        setDetailDate(null);
        return;
      }
      const refresh = () => {
        void summaryReader.load('overview', () => listDailyActivitySummaries(90));
      };

      refresh();
      const unsubscribe = subscribeToLocalDataChanges(refresh);
      return () => {
        summaryReader.cancel();
        unsubscribe();
      };
      // 身份恢复及 token 更新后需要重新读取当前资料。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [summaryReader, detailReader, token, authLoading]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!detailDate || authLoading) return;
      const refresh = () => {
        void detailReader.load(detailDate, () => getDailyDataDetails(detailDate));
      };
      refresh();
      const unsubscribe = subscribeToLocalDataChanges(refresh);
      return () => {
        detailReader.cancel();
        unsubscribe();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailReader, detailDate, token, authLoading]),
  );

  const openDateDetails = (date: string, section: DailyDataDetailSection | null = null) => {
    setActiveDate(date);
    setDetailDate(date);
    setDetailSection(section);
  };
  const summaryCurrent =
    !authLoading && summaryState.generation !== null && authSessionContext.isGenerationCurrent(summaryState.generation);
  const detailCurrent =
    !authLoading &&
    detailState.generation !== null &&
    authSessionContext.isGenerationCurrent(detailState.generation) &&
    detailState.key === detailDate;
  const summaries = summaryCurrent ? summaryState.data : null;
  const today = summaries?.at(-1) ?? emptyDailySummary(getLocalDateKey());

  return (
    <Screen scrollEnabled={!trendGestureActive}>
      <PageHeader subtitle="从今天的细节，到 90 天的身体节奏。" title="数据回看" />

      {!summaryCurrent || summaryState.phase !== 'ready' ? (
        <AppCard>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: summaryCurrent && summaryState.error ? colors.danger : colors.textMuted }}
          >
            {!summaryCurrent || summaryState.phase === 'loading'
              ? summaries
                ? '正在更新记录…'
                : '正在读取记录…'
              : summaryState.phase === 'error'
                ? `记录读取失败：${summaryState.error}${summaries ? ' 当前保留上次读取的数据。' : ''}`
                : '最近 90 天还没有记录。'}
          </Text>
          {summaryCurrent && summaryState.phase === 'error' ? (
            <AppButton
              variant="secondary"
              onPress={() => void summaryReader.load('overview', () => listDailyActivitySummaries(90))}
            >
              重新读取
            </AppButton>
          ) : null}
        </AppCard>
      ) : null}

      {summaries ? (
        <>
          <TodayDataOverview onOpenDetails={(section) => openDateDetails(today.date, section)} summary={today} />

          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>90 天日历</Text>
              <Text style={styles.sectionCaption}>点选日期，查看当天训练、小账本和蹲会儿明细</Text>
            </View>
            <View style={styles.privacyPill}>
              <Text style={styles.privacyPillText}>保留 90 天</Text>
            </View>
          </View>
          <DailyDataCalendar onSelectDate={openDateDetails} selectedDate={activeDate} summaries={summaries} />

          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>趋势折线</Text>
              <Text style={styles.sectionCaption}>切换 7、30、90 天，左右滑动查看单日数据</Text>
            </View>
          </View>
          <DataTrendChart
            onGestureActiveChange={setTrendGestureActive}
            onOpenDate={openDateDetails}
            onSelectDate={setActiveDate}
            selectedDate={activeDate}
            summaries={summaries}
          />
        </>
      ) : null}

      <DailyDataDetailModal
        date={detailDate}
        details={detailCurrent ? detailState.data : null}
        loading={!detailCurrent || detailState.phase === 'loading'}
        error={detailCurrent ? detailState.error : null}
        onRetry={() => {
          if (detailDate) void detailReader.load(detailDate, () => getDailyDataDetails(detailDate));
        }}
        onEditToiletRecord={(id) => {
          detailReader.reset();
          setDetailDate(null);
          setDetailSection(null);
          router.push(routes.toiletRecord(id));
        }}
        onClose={() => {
          detailReader.reset();
          setDetailDate(null);
          setDetailSection(null);
        }}
        section={detailSection}
      />
    </Screen>
  );
}
