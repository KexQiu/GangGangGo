import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Bell,
  ChevronRight,
  MessageCircle,
  PauseCircle,
  RefreshCw,
  Settings,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type { TeamMember, TeamSnapshot } from '@xiaotidu/contracts';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PressableScale } from '../../src/components/feedback/PressableScale';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { ProfileAvatar } from '../../src/components/ProfileAvatar';
import { Screen } from '../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../src/features/account/authStore';
import {
  getDisplayName,
  getNudgeThreads,
  useNudgeStore,
  type NudgeThread,
} from '../../src/features/nudges/nudgeStore';
import { useReportStore } from '../../src/features/reports/reportStore';
import { useTeamStore } from '../../src/features/team/teamStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TeamScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accessToken = useAuthStore((state) => state.accessToken);
  const proStatus = useAuthStore((state) => state.proStatus);
  const user = useAuthStore((state) => state.user);
  const createTeam = useTeamStore((state) => state.createTeam);
  const isLoading = useTeamStore((state) => state.isLoading);
  const isMutating = useTeamStore((state) => state.isMutating);
  const loadCurrentTeam = useTeamStore((state) => state.loadCurrentTeam);
  const snapshots = useTeamStore((state) => state.snapshots);
  const team = useTeamStore((state) => state.team);
  const teamError = useTeamStore((state) => state.error);
  const inbox = useNudgeStore((state) => state.inbox);
  const nudgeError = useNudgeStore((state) => state.error);
  const nudgeIsLoading = useNudgeStore((state) => state.isLoading);
  const loadThreads = useNudgeStore((state) => state.loadThreads);
  const sent = useNudgeStore((state) => state.sent);
  const loadTeamWeeklyReport = useReportStore((state) => state.loadTeamWeeklyReport);
  const teamWeeklyReport = useReportStore((state) => state.teamWeeklyReport);
  const isPro = isProStatus(proStatus);
  const currentUserId = user?.id;
  const activeMembers = team?.members.filter((member) => member.status !== 'removed') ?? [];
  const buddyMembers = activeMembers.filter((member) => member.user.id !== currentUserId);
  const threads = useMemo(
    () =>
      getNudgeThreads({
        currentUserId,
        inbox,
        members: team?.members,
        sent,
      }),
    [currentUserId, inbox, sent, team?.members],
  );
  const threadByUserId = useMemo(
    () => new Map(threads.map((thread) => [thread.buddy.id, thread])),
    [threads],
  );
  const pendingCount = threads.reduce((total, thread) => total + thread.pendingCount, 0);
  const isSyncing = isLoading || nudgeIsLoading;

  const refreshTeam = useCallback(() => {
    if (!accessToken) {
      void loadCurrentTeam();
      return;
    }

    void loadCurrentTeam();
    void loadTeamWeeklyReport();
    void loadThreads();
  }, [accessToken, loadCurrentTeam, loadTeamWeeklyReport, loadThreads]);

  useFocusEffect(
    useCallback(() => {
      refreshTeam();
    }, [refreshTeam]),
  );

  const handleRefresh = useCallback(() => {
    void loadCurrentTeam();
    void loadTeamWeeklyReport();
    void loadThreads();
  }, [loadCurrentTeam, loadTeamWeeklyReport, loadThreads]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.me} title="监督搭子" />

      <PageStack gap="regular">
        {!user ? (
          <AppCard style={styles.emptyCard}>
            <UsersRound color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>先登录小提督</Text>
            <Text style={styles.emptyBody}>登录后才能加入小队、接收搭子提醒。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去我的页面登录</AppButton>
          </AppCard>
        ) : null}

        {user && !team ? (
          <AppCard style={styles.emptyCard}>
            <UsersRound color={colors.primaryPressed} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>还没有监督搭子</Text>
            <Text style={styles.emptyBody}>先拉一个信得过的人进来，之后提醒和回执都在这里来回。</Text>
            <AppButton
              disabled={isMutating}
              onPress={() => {
                if (!isPro) {
                  router.push(routes.pro);
                  return;
                }

                void createTeam('小提督小队');
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
                  <PressableScale
                    accessibilityLabel="同步监督搭子"
                    onPress={handleRefresh}
                    style={styles.iconButton}
                  >
                    <RefreshCw color={colors.text} size={19} strokeWidth={2.4} />
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel="邀请搭子"
                    onPress={() => (isPro ? router.push(routes.teamInvite) : router.push(routes.pro))}
                    style={styles.iconButton}
                  >
                    <UserPlus color={colors.text} size={19} strokeWidth={2.4} />
                  </PressableScale>
                  <PressableScale accessibilityLabel="小队设置" onPress={() => router.push(routes.teamSettings)} style={styles.iconButton}>
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
                  <Text style={[styles.statLabel, pendingCount > 0 ? styles.pendingStatLabel : null]}>
                    待回应
                  </Text>
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

        {teamError ? <Text style={styles.errorText}>{teamError}</Text> : null}
        {nudgeError ? <Text style={styles.errorText}>{nudgeError}</Text> : null}
        {isSyncing ? <Text style={styles.loadingText}>监督搭子同步中...</Text> : null}
      </PageStack>
    </Screen>
  );
}

type BuddyConversationRowProps = {
  isLast: boolean;
  member: TeamMember;
  onPress: () => void;
  snapshot?: TeamSnapshot['snapshot'];
  thread?: NudgeThread;
};

function BuddyConversationRow({ isLast, member, onPress, snapshot, thread }: BuddyConversationRowProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const displayName = member.displayName ?? member.user.nickname ?? getDisplayName(member.user);
  const primaryText = getBuddyPrimaryText({ member, snapshot, thread });
  const secondaryText = getBuddySecondaryText({ member, snapshot, thread });
  const pendingCount = thread?.pendingCount ?? 0;

  return (
    <PressableScale
      accessibilityLabel={`${displayName}，${primaryText}`}
      onPress={onPress}
      style={[styles.buddyRow, isLast ? styles.buddyRowLast : null]}
    >
      <ProfileAvatar avatarUrl={member.user.avatarUrl} nickname={displayName} size="sm" />
      <View style={styles.buddyCopy}>
        <View style={styles.buddyTitleLine}>
          <Text numberOfLines={1} style={styles.buddyName}>
            {displayName}
          </Text>
          {member.status === 'paused' ? <PauseCircle color={colors.warning} size={18} strokeWidth={2.4} /> : null}
          {thread?.latestAt ? <Text style={styles.buddyTime}>{formatThreadTime(thread.latestAt)}</Text> : null}
        </View>
        <Text numberOfLines={2} style={[styles.buddyPrimary, pendingCount > 0 ? styles.buddyPrimaryPending : null]}>
          {primaryText}
        </Text>
        {secondaryText ? (
          <Text numberOfLines={1} style={styles.buddySecondary}>
            {secondaryText}
          </Text>
        ) : null}
      </View>
      <View style={styles.buddyTrailing}>
        {pendingCount > 0 ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
        ) : null}
        <ChevronRight color={colors.textSubtle} size={18} strokeWidth={2.4} />
      </View>
    </PressableScale>
  );
}

type BuddyTextInput = {
  member: TeamMember;
  snapshot?: TeamSnapshot['snapshot'];
  thread?: NudgeThread;
};

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    avatarOverflow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.surface,
      borderRadius: 20,
      borderWidth: 2,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    avatarOverflowText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },
    avatarStack: {
      flexDirection: 'row',
    },
    avatarStackItem: {
      borderColor: colors.surface,
      borderRadius: 22,
      borderWidth: 2,
    },
    avatarStackOverlap: {
      marginLeft: -10,
    },
    buddyList: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 0,
      paddingHorizontal: 12,
    },
    buddyCopy: {
      flex: 1,
      gap: 4,
    },
    buddyRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 88,
      paddingVertical: 14,
    },
    buddyRowLast: {
      borderBottomWidth: 0,
    },
    buddyName: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '900',
    },
    buddyPrimary: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
    },
    buddyPrimaryPending: {
      color: colors.danger,
    },
    buddySecondary: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    buddyTime: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '700',
    },
    buddyTitleLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    buddyTrailing: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      gap: 12,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      textAlign: 'center',
    },
    iconActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      textAlign: 'center',
    },
    pendingBadge: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    pendingBadgeText: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '900',
    },
    pendingStatLabel: {
      color: colors.warning,
    },
    pendingStatPill: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    pendingStatValue: {
      color: colors.warning,
    },
    socialCopy: {
      gap: 0,
    },
    socialHeader: {
      gap: 14,
    },
    socialTopLine: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    statPill: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      gap: 3,
      minHeight: 54,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    statRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    teamName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 28,
    },
    weeklyCopy: {
      flex: 1,
      gap: 3,
    },
    weeklyStrip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 14,
    },
    weeklyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    weeklyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}

function getBuddyPrimaryText({ member, snapshot, thread }: BuddyTextInput) {
  if ((thread?.pendingCount ?? 0) > 0) {
    return `${thread?.pendingCount ?? 0} 条提醒待回应`;
  }

  if (thread?.latestAt) {
    return thread.latestPreview;
  }

  if (snapshot) {
    return formatSnapshot(snapshot);
  }

  if (member.status === 'paused') {
    return '暂停共享中';
  }

  return '今日未登录';
}

function getBuddySecondaryText({ member, snapshot, thread }: BuddyTextInput) {
  if (member.status === 'paused') {
    return '对方暂停共享中，暂时不能接收提醒。';
  }

  if ((thread?.pendingCount ?? 0) > 0 && snapshot) {
    return formatSnapshot(snapshot);
  }

  if ((thread?.pendingCount ?? 0) > 0) {
    return '今日未登录';
  }

  if (thread?.latestAt && snapshot) {
    return formatSnapshot(snapshot);
  }

  if (thread?.latestAt) {
    return '今日未登录';
  }

  return null;
}

function formatSnapshot(snapshot: TeamSnapshot['snapshot'] | undefined) {
  if (!snapshot) {
    return '今日未登录';
  }

  const parts = [
    snapshot.trainingDone === undefined ? null : snapshot.trainingDone ? '小花已营业' : '小花待营业',
    snapshot.habitCompletion === undefined ? null : `小账本 ${snapshot.habitCompletion}/4`,
    snapshot.toiletRecorded === undefined ? null : snapshot.toiletRecorded ? '蹲会儿已记' : '蹲会儿未记',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '今天低调共享中';
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat('zh-CN', {
    day: isToday ? undefined : '2-digit',
    hour: isToday ? '2-digit' : undefined,
    hour12: false,
    minute: isToday ? '2-digit' : undefined,
    month: isToday ? undefined : '2-digit',
  }).format(date);
}

function formatWeeklyReport(teamWeeklyReport: ReturnType<typeof useReportStore.getState>['teamWeeklyReport']) {
  if (!teamWeeklyReport) {
    return '等大家同步一点低敏摘要，小报告就会出现。';
  }

  const trainingDays = teamWeeklyReport.summaries.reduce((total, item) => total + item.trainingDays, 0);
  const habitFullDays = teamWeeklyReport.summaries.reduce((total, item) => total + item.habitFullDays, 0);

  return `小队 ${teamWeeklyReport.memberCount} 人 · 训练达标 ${trainingDays} 天 · 小账本满格 ${habitFullDays} 天`;
}
