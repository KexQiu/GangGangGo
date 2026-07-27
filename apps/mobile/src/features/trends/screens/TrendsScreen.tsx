import type { DailyActivitySummary } from '@xiaotidu/contracts';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { useAppTheme } from '../../../theme/themeProvider';
import {
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

export default function TrendsScreen() {
  const [summaries, setSummaries] = useState<DailyActivitySummary[]>(createInitialSummaries);
  const [activeDate, setActiveDate] = useState(getLocalDateKey);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [details, setDetails] = useState<DailyDataDetails | null>(null);
  const [trendGestureActive, setTrendGestureActive] = useState(false);
  const detailRequestRef = useRef(0);
  const { colors } = useAppTheme();
  const styles = createDataStyles(colors);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        void listDailyActivitySummaries(90)
          .then((next) => {
            if (active) setSummaries(next);
          })
          .catch(() => undefined);
      };

      refresh();
      const unsubscribe = subscribeToLocalDataChanges(refresh);
      return () => {
        active = false;
        unsubscribe();
      };
    }, []),
  );

  const openDateDetails = (date: string) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setActiveDate(date);
    setDetailDate(date);
    setDetails(null);
    void getDailyDataDetails(date)
      .then((next) => {
        if (detailRequestRef.current === requestId) setDetails(next);
      })
      .catch(() => {
        if (detailRequestRef.current === requestId) setDetails(null);
      });
  };
  const today = summaries.at(-1) ?? emptyDailySummary(getLocalDateKey());

  return (
    <Screen scrollEnabled={!trendGestureActive}>
      <PageHeader subtitle="从今天的细节，到 90 天的身体节奏。" title="数据回看" />

      <TodayDataOverview summary={today} />

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

      <DailyDataDetailModal
        date={detailDate}
        details={details}
        onClose={() => {
          detailRequestRef.current += 1;
          setDetailDate(null);
          setDetails(null);
        }}
      />
    </Screen>
  );
}

function createInitialSummaries() {
  const now = new Date();
  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (89 - index));
    return emptyDailySummary(getLocalDateKey(date));
  });
}
