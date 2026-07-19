import {
  CompactActionRow,
  OverviewMetric,
  ReminderSetupPrompt,
  TeamHomeCard,
  UtilityLink,
} from '../sections/TodaySections';
import { createStyles } from '../styles/todayStyles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  ChartNoAxesColumnIncreasing,
  Hourglass,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { queryClient } from '../../../api/queryClient';
import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { useCurrentUserQuery } from '../../../features/account/accountQueries';
import { useAuthStore } from '../../../features/account/authStore';
import {
  calculateHabitCompletion,
  createEmptyHabitCheckIn,
  getLocalDateKey,
} from '../../../features/habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../../../features/habits/habitStore';
import { HabitQuickCheckInCard } from '../../../features/habits/HabitQuickCheckInCard';
import { getReminderHomeSummary, hasAnyReminderEnabled } from '../../../features/reminders/reminderLogic';
import { useReminderStore } from '../../../features/reminders/reminderStore';
import { getNudgeHomeSummaryFromThreads } from '../../../features/nudges/nudgeModel';
import { nudgePollIntervalMs, shouldPollNudges } from '../../../features/nudges/nudgePolling';
import { cancelNudgeQueries } from '../../../features/nudges/nudgeQueryCache';
import { useNudgeThreadsQuery } from '../../../features/nudges/nudgeQueries';
import {
  getHabitStatusLabel,
  getTodayPositiveFeedback,
  getToiletStatusLabel,
  getTrainingStatusLabel,
} from '../../../features/today/todayFeedback';
import { useCurrentTeamQuery, useTeamSnapshotsQuery } from '../../../features/team/teamQueries';
import { getTodayToiletSessionCount, useToiletStore } from '../../../features/toilet/toiletStore';
import { FlowerLiftIcon } from '../../../features/training/FlowerLiftIcon';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../../../features/training/trainingStore';
import { buildSevenDayTrend } from '../../../features/trends/trendLogic';
import { routes } from '../../../navigation/routes';
import { useForegroundFocus } from '../../../navigation/useForegroundFocus';
import { useAppTheme } from '../../../theme/themeProvider';

const trainingTarget = 2;

export default function HomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useCurrentUserQuery().data;
  const checkIns = useHabitStore((state) => state.checkIns);
  const reminderSettings = useReminderStore((state) => state.settings);
  const toiletSessions = useToiletStore((state) => state.sessions);
  const trainingSessions = useTrainingStore((state) => state.sessions);
  const {
    data: teamData,
    error: teamError,
    isFetching: isFetchingTeam,
    refetch: refetchTeam,
  } = useCurrentTeamQuery({ enabled: Boolean(accessToken && user?.id) });
  const team = teamData?.team ?? null;
  const {
    data: teamSnapshotsData,
    error: teamSnapshotsError,
    isFetching: isFetchingTeamSnapshots,
    refetch: refetchTeamSnapshots,
  } = useTeamSnapshotsQuery({ enabled: Boolean(team) });
  const teamSnapshots = teamSnapshotsData ?? null;
  const { isAppActive, isFocused } = useForegroundFocus();
  const shouldPollNudgeThreads = shouldPollNudges({
    hasSession: Boolean(accessToken && user?.id),
    hasTarget: Boolean(team),
    isAppActive,
    isFocused,
  });
  const {
    data: nudgeThreadsData,
    error: nudgeThreadsError,
    isFetching: isFetchingNudgeThreads,
    refetch: refetchNudgeThreads,
  } = useNudgeThreadsQuery({
    enabled: shouldPollNudgeThreads,
    refetchInterval: shouldPollNudgeThreads ? nudgePollIntervalMs : false,
  });
  const todayTrainingCount = getTodayCompletedTrainingCount(trainingSessions);
  const todayToiletCount = getTodayToiletSessionCount(toiletSessions);
  const today = getLocalDateKey();
  const todayCheckIn = getHabitCheckInForDate(checkIns, today) ?? createEmptyHabitCheckIn(today);
  const habitCompletion = calculateHabitCompletion(todayCheckIn);
  const hasReminderEnabled = hasAnyReminderEnabled(reminderSettings);
  const reminderSummary = getReminderHomeSummary(reminderSettings);
  const todayFeedback = getTodayPositiveFeedback({
    habitCompletion,
    toiletSessionCount: todayToiletCount,
    trainingCount: todayTrainingCount,
    trainingTarget,
  });
  const sevenDayTrend = buildSevenDayTrend({
    habitCheckIns: checkIns,
    toiletSessions,
    trainingSessions,
  });
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const userId = user?.id;
  const nudgeSummary = useMemo(
    () => getNudgeHomeSummaryFromThreads(nudgeThreadsData?.threads ?? []),
    [nudgeThreadsData],
  );

  const refreshTeamHomeCard = useCallback(() => {
    if (!accessToken || !userId) return;

    void refetchTeam();
    if (team) {
      void refetchTeamSnapshots();
      void refetchNudgeThreads();
    }

    return () => {
      void cancelNudgeQueries(queryClient, userId);
    };
  }, [accessToken, refetchNudgeThreads, refetchTeam, refetchTeamSnapshots, team, userId]);

  useFocusEffect(refreshTeamHomeCard);

  useEffect(() => {
    if (isAppActive || !userId) return;
    void cancelNudgeQueries(queryClient, userId);
  }, [isAppActive, userId]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <PageHeader eyebrow="小提督" subtitle="少找入口，多做正事。" title="今天轻轻安排一下" />
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            accessibilityLabel="打开我的"
            onPress={() => router.push(routes.me)}
            style={styles.headerButton}
          >
            <UserRound color={colors.text} size={21} strokeWidth={2.5} />
          </PressableScale>
          <PressableScale
            accessibilityLabel="打开设置"
            onPress={() => router.push(routes.settings)}
            style={styles.headerButton}
          >
            <Settings color={colors.text} size={21} strokeWidth={2.5} />
          </PressableScale>
        </View>
      </View>

      <AppCard muted style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <View style={styles.feedbackIcon}>
            <CheckCircle2 color={colors.primaryPressed} size={20} strokeWidth={2.4} />
          </View>
          <View style={styles.feedbackCopy}>
            <Text style={styles.feedbackTitle}>{todayFeedback.title}</Text>
            <Text style={styles.mutedText}>{todayFeedback.body}</Text>
          </View>
        </View>

        <View style={styles.overviewMetrics}>
          <OverviewMetric
            label="菊花抬"
            status={getTrainingStatusLabel(todayTrainingCount, trainingTarget)}
            value={`${Math.min(todayTrainingCount, trainingTarget)}/${trainingTarget}`}
          />
          <OverviewMetric label="小账本" status={getHabitStatusLabel(habitCompletion)} value={`${habitCompletion}/4`} />
          <OverviewMetric
            label="蹲会儿"
            status={getToiletStatusLabel(todayToiletCount)}
            value={`${todayToiletCount} 次`}
          />
        </View>
      </AppCard>

      {user ? (
        <TeamHomeCard
          error={
            teamError?.message ?? (team ? (teamSnapshotsError?.message ?? nudgeThreadsError?.message) : null) ?? null
          }
          isLoading={isFetchingTeam || isFetchingTeamSnapshots || isFetchingNudgeThreads}
          onPress={() => router.push(routes.team)}
          nudgeSummary={nudgeSummary}
          snapshots={teamSnapshots}
          team={team}
        />
      ) : null}

      {!hasReminderEnabled ? <ReminderSetupPrompt onPress={() => router.push(routes.reminders)} /> : null}

      <AppCard muted style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {todayTrainingCount >= trainingTarget ? '今日小花已下班' : '今日菊花抬'}
            </Text>
            <Text style={styles.mutedText}>
              {todayTrainingCount >= trainingTarget
                ? '建议量已完成，休息和放松也是正经训练。'
                : '也就是提肛训练。轻抬轻放，呼吸在线。'}
            </Text>
          </View>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <FlowerLiftIcon
                info={colors.primaryPressed}
                primary={colors.primary}
                privacy={colors.primaryPressed}
                size={42}
                surface={colors.surface}
                variant="steady"
              />
            </View>
          </View>
        </View>

        <AppButton onPress={() => router.push(routes.training)}>
          {todayTrainingCount >= trainingTarget ? '再看一眼节奏' : '开始菊花抬'}
        </AppButton>
      </AppCard>

      <CompactActionRow
        description="正事办完就撤，别把蹲会儿开成小长会。"
        icon={Hourglass}
        onPress={() => router.push(routes.toilet)}
        title="蹲会儿"
      />

      <HabitQuickCheckInCard compact showDetailsButton />

      <AppCard style={styles.toolCard}>
        <UtilityLink
          description={`这周小花训练达标 ${sevenDayTrend.trainingActiveDays} 天，小账本满格 ${sevenDayTrend.habitFullDays} 天。`}
          icon={ChartNoAxesColumnIncreasing}
          iconColor={colors.primaryPressed}
          iconTone={colors.primarySoft}
          onPress={() => router.push(routes.trends)}
          title="最近小报告"
        />
        {hasReminderEnabled ? (
          <>
            <View style={styles.toolDivider} />
            <UtilityLink
              description={reminderSummary.subtitle}
              icon={Bell}
              iconColor={colors.privacy}
              iconTone={colors.surfaceMuted}
              onPress={() => router.push(routes.reminders)}
              title={reminderSummary.title}
            />
          </>
        ) : null}
        <View style={styles.toolDivider} />
        <UtilityLink
          description="明显便血、剧烈疼痛或不适加重时，先别硬扛。"
          icon={ShieldCheck}
          iconColor={colors.info}
          iconTone={colors.infoSoft}
          onPress={() => router.push(routes.safety)}
          title="安全说明"
        />
      </AppCard>
    </Screen>
  );
}
