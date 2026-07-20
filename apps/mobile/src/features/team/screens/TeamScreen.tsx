import { BuddyConversationRow } from '../sections/TeamSections';
import { createStyles } from '../styles/teamStyles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Bell, MessageCircle, RefreshCw, Settings, UserPlus, UsersRound } from 'lucide-react-native';

import { queryClient } from '../../../api/queryClient';
import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { PageHeader } from '../../../components/PageHeader';
import { PageSection, PageStack } from '../../../components/PageStack';
import { ProfileAvatar } from '../../../components/ProfileAvatar';
import { Screen } from '../../../components/Screen';
import { defaultProStatus, isProStatus } from '../../../features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../../features/account/accountQueries';
import { useAuthStore } from '../../../features/account/authStore';
import { nudgePollIntervalMs, shouldPollNudges } from '../../../features/nudges/nudgePolling';
import { cancelNudgeQueries } from '../../../features/nudges/nudgeQueryCache';
import { useNudgeThreadsQuery } from '../../../features/nudges/nudgeQueries';
import { useTeamWeeklyReportQuery } from '../../../features/reports/reportQueries';
import { useCreateTeamMutation, useCurrentTeamQuery, useTeamSnapshotsQuery } from '../../../features/team/teamQueries';
import { formatWeeklyReport } from '../../../features/team/teamPresentation';
import { routes } from '../../../navigation/routes';
import { useForegroundFocus } from '../../../navigation/useForegroundFocus';
import { useAppTheme } from '../../../theme/themeProvider';

export default function TeamScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accessToken = useAuthStore((state) => state.accessToken);
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const user = useCurrentUserQuery().data;
  const isPro = isProStatus(proStatus);
  const currentUserId = user?.id;
  const { data: teamData, error: teamError, isFetching: isFetchingTeam, refetch: refetchTeam } = useCurrentTeamQuery();
  const team = teamData?.team ?? null;
  const {
    data: snapshotsData,
    error: snapshotsError,
    isFetching: isFetchingSnapshots,
    refetch: refetchSnapshots,
  } = useTeamSnapshotsQuery({ enabled: Boolean(team) });
  const snapshots = snapshotsData ?? null;
  const createTeam = useCreateTeamMutation();
  const { data: weeklyReportData, refetch: refetchWeeklyReport } = useTeamWeeklyReportQuery({
    enabled: Boolean(team),
  });
  const teamWeeklyReport = weeklyReportData ?? null;
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
  const threads = useMemo(() => nudgeThreadsData?.threads ?? [], [nudgeThreadsData]);
  const activeMembers = team?.members.filter((member) => member.status !== 'removed') ?? [];
  const buddyMembers = activeMembers.filter((member) => member.user.id !== currentUserId);
  const threadByUserId = useMemo(() => new Map(threads.map((thread) => [thread.buddy.id, thread])), [threads]);
  const pendingCount = threads.reduce((total, thread) => total + thread.pendingCount, 0);
  const isSyncing = isFetchingTeam || isFetchingSnapshots || isFetchingNudgeThreads;

  const refreshTeam = useCallback(() => {
    if (!accessToken) return;

    void refetchTeam();
    if (team) {
      void refetchSnapshots();
      if (isPro) void refetchWeeklyReport();
      void refetchNudgeThreads();
    }
  }, [accessToken, isPro, refetchNudgeThreads, refetchSnapshots, refetchTeam, refetchWeeklyReport, team]);

  useFocusEffect(
    useCallback(() => {
      refreshTeam();
      return () => {
        if (currentUserId) {
          void cancelNudgeQueries(queryClient, currentUserId);
        }
      };
    }, [currentUserId, refreshTeam]),
  );

  useEffect(() => {
    if (isAppActive || !currentUserId) return;
    void cancelNudgeQueries(queryClient, currentUserId);
  }, [currentUserId, isAppActive]);

  const handleRefresh = useCallback(() => {
    void refetchTeam();
    if (team) {
      void refetchSnapshots();
      if (isPro) void refetchWeeklyReport();
      void refetchNudgeThreads();
    }
  }, [isPro, refetchNudgeThreads, refetchSnapshots, refetchTeam, refetchWeeklyReport, team]);

  return (
    <Screen contentStyle={!user ? styles.loggedOutContent : undefined}>
      <PageHeader eyebrow="好友" subtitle="一起记住轻轻行动，也把提醒说得体面。" title="监督搭子" />
      <PageStack gap="regular" style={!user ? styles.loggedOutStack : undefined}>
        {!user ? (
          <AppCard style={styles.emptyCard}>
            <UsersRound color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>先登录小提督</Text>
            <Text style={styles.emptyBody}>登录后才能加入小队、接收搭子提醒。</Text>
            <Text style={styles.loggedOutBenefits}>轻提醒 · 每周回看 · 私密互助</Text>
            <AppButton onPress={() => router.push(routes.me)}>登录后加入搭子</AppButton>
          </AppCard>
        ) : null}

        {user && !team ? (
          <AppCard style={styles.emptyCard}>
            <UsersRound color={colors.primaryPressed} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>还没有监督搭子</Text>
            <Text style={styles.emptyBody}>先拉一个信得过的人进来，之后提醒和回执都在这里来回。</Text>
            <AppButton
              disabled={createTeam.isPending}
              onPress={() => {
                if (!isPro) {
                  router.push(routes.pro);
                  return;
                }

                createTeam.mutate('小提督小队');
              }}
            >
              {isPro ? '创建小队' : '了解 Pro'}
            </AppButton>
          </AppCard>
        ) : null}

        {user && team ? (
          <>
            <AppCard style={styles.socialHeader}>
              <View style={styles.socialTopLine}>
                <View style={styles.avatarStack}>
                  {activeMembers.slice(0, 4).map((member, index) => (
                    <View
                      key={member.id}
                      style={[styles.avatarStackItem, index > 0 ? styles.avatarStackOverlap : null]}
                    >
                      <ProfileAvatar
                        avatarUrl={member.user.avatarUrl}
                        nickname={member.displayName ?? member.user.nickname}
                        size="sm"
                      />
                    </View>
                  ))}
                  {activeMembers.length > 4 ? (
                    <View style={[styles.avatarOverflow, styles.avatarStackOverlap]}>
                      <Text style={styles.avatarOverflowText}>+{activeMembers.length - 4}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.iconActions}>
                  <PressableScale accessibilityLabel="同步监督搭子" onPress={handleRefresh} style={styles.iconButton}>
                    <RefreshCw color={colors.text} size={19} strokeWidth={2.4} />
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel="邀请搭子"
                    onPress={() => (isPro ? router.push(routes.teamInvite) : router.push(routes.pro))}
                    style={styles.iconButton}
                  >
                    <UserPlus color={colors.text} size={19} strokeWidth={2.4} />
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel="小队设置"
                    onPress={() => router.push(routes.teamSettings)}
                    style={styles.iconButton}
                  >
                    <Settings color={colors.text} size={19} strokeWidth={2.4} />
                  </PressableScale>
                </View>
              </View>

              <View style={styles.socialCopy}>
                <Text style={styles.teamName}>{team.name}</Text>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{activeMembers.length}/4</Text>
                  <Text style={styles.statLabel}>成员</Text>
                </View>
                <View style={[styles.statPill, pendingCount > 0 ? styles.pendingStatPill : null]}>
                  <Text style={[styles.statValue, pendingCount > 0 ? styles.pendingStatValue : null]}>
                    {pendingCount}
                  </Text>
                  <Text style={[styles.statLabel, pendingCount > 0 ? styles.pendingStatLabel : null]}>待回应</Text>
                </View>
              </View>
            </AppCard>

            <PageSection subtitle="最近的提醒、回执和今日状态都在这里。" title="搭子动态">
              {buddyMembers.length === 0 ? (
                <AppCard style={styles.emptyCard}>
                  <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
                  <Text style={styles.emptyTitle}>还没有搭子</Text>
                  <Text style={styles.emptyBody}>邀请一个搭子加入后，就能互相发小暗号。</Text>
                  <AppButton onPress={() => (isPro ? router.push(routes.teamInvite) : router.push(routes.pro))}>
                    {isPro ? '邀请搭子' : '了解 Pro'}
                  </AppButton>
                </AppCard>
              ) : (
                <View style={styles.buddyList}>
                  {buddyMembers.map((member, index) => {
                    const snapshot = snapshots?.snapshots.find((item) => item.member.id === member.id);
                    const thread = threadByUserId.get(member.user.id);

                    return (
                      <BuddyConversationRow
                        isLast={index === buddyMembers.length - 1}
                        key={member.id}
                        member={member}
                        onPress={() => router.push(routes.nudgeChat(member.user.id))}
                        snapshot={snapshot?.snapshot ?? undefined}
                        thread={thread}
                      />
                    );
                  })}
                </View>
              )}
            </PageSection>

            {isPro ? (
              <View style={styles.weeklyStrip}>
                <Bell color={colors.privacy} size={18} strokeWidth={2.4} />
                <View style={styles.weeklyCopy}>
                  <Text style={styles.weeklyTitle}>本周小队小报告</Text>
                  <Text style={styles.weeklyText}>{formatWeeklyReport(teamWeeklyReport)}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {teamError ? <Text style={styles.errorText}>{teamError.message}</Text> : null}
        {team && snapshotsError ? <Text style={styles.errorText}>{snapshotsError.message}</Text> : null}
        {team && nudgeThreadsError ? <Text style={styles.errorText}>{nudgeThreadsError.message}</Text> : null}
        {isSyncing ? <Text style={styles.loadingText}>监督搭子同步中...</Text> : null}
      </PageStack>
    </Screen>
  );
}
