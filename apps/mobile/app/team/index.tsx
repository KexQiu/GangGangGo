import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PauseCircle, Settings, UsersRound } from 'lucide-react-native';
import type { TeamSnapshot } from '@xiaotidu/contracts';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PressableScale } from '../../src/components/feedback/PressableScale';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { ProfileAvatar } from '../../src/components/ProfileAvatar';
import { Screen } from '../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../src/features/account/authStore';
import { useNudgeStore } from '../../src/features/nudges/nudgeStore';
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
  const error = useTeamStore((state) => state.error);
  const isLoading = useTeamStore((state) => state.isLoading);
  const isMutating = useTeamStore((state) => state.isMutating);
  const loadCurrentTeam = useTeamStore((state) => state.loadCurrentTeam);
  const loadSnapshots = useTeamStore((state) => state.loadSnapshots);
  const snapshots = useTeamStore((state) => state.snapshots);
  const team = useTeamStore((state) => state.team);
  const sendNudge = useNudgeStore((state) => state.sendNudge);
  const nudgeError = useNudgeStore((state) => state.error);
  const loadTeamWeeklyReport = useReportStore((state) => state.loadTeamWeeklyReport);
  const teamWeeklyReport = useReportStore((state) => state.teamWeeklyReport);
  const isPro = isProStatus(proStatus);
  const currentUserId = user?.id;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void loadCurrentTeam();
    void loadTeamWeeklyReport();
  }, [accessToken, loadCurrentTeam, loadTeamWeeklyReport]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.me} title="监督搭子" />
      <PageHeader eyebrow="小队" subtitle="只共享完成状态，不把敏感细节搬上桌。" title="互相轻轻盯一下" />

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
            <Text style={styles.emptyBody}>Pro 可以创建小队；收到邀请的用户可以直接加入。</Text>
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
            <AppCard style={styles.teamHeader}>
              <View style={styles.teamTitleLine}>
                <View>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamMeta}>成员 {team.members.filter((member) => member.status !== 'removed').length}/4</Text>
                </View>
                <PressableScale accessibilityLabel="小队设置" onPress={() => router.push(routes.teamSettings)} style={styles.iconButton}>
                  <Settings color={colors.text} size={20} strokeWidth={2.4} />
                </PressableScale>
              </View>
              <View style={styles.teamActions}>
                <AppButton
                  onPress={() => (isPro ? router.push(routes.teamInvite) : router.push(routes.pro))}
                  style={styles.flexButton}
                  variant="secondary"
                >
                  邀请搭子
                </AppButton>
                <AppButton onPress={() => void loadSnapshots()} style={styles.flexButton} variant="secondary">
                  刷新状态
                </AppButton>
              </View>
            </AppCard>

            {isPro ? (
              <AppCard style={styles.weeklyCard}>
                <Text style={styles.weeklyTitle}>本周小队小报告</Text>
                {teamWeeklyReport ? (
                  <Text style={styles.memberStatus}>
                    小队 {teamWeeklyReport.memberCount} 人 · 训练达标 {teamWeeklyReport.summaries.reduce((total, item) => total + item.trainingDays, 0)} 天 · 小账本满格 {teamWeeklyReport.summaries.reduce((total, item) => total + item.habitFullDays, 0)} 天
                  </Text>
                ) : (
                  <Text style={styles.memberStatus}>等大家同步一点低敏摘要，小报告就会出现。</Text>
                )}
              </AppCard>
            ) : null}

            <PageSection subtitle="只展示成员允许共享的低敏状态。" title="今日状态">
              {team.members
                .filter((member) => member.status !== 'removed')
                .map((member) => {
                  const snapshot = snapshots?.snapshots.find((item) => item.member.id === member.id);
                  const isMe = member.user.id === currentUserId;

                  return (
                    <PressableScale
                      accessibilityLabel={`查看 ${member.displayName ?? member.user.nickname ?? '搭子'} 详情`}
                      key={member.id}
                      onPress={() => router.push(`/team/member/${member.user.id}`)}
                      style={styles.memberCard}
                    >
                      <View style={styles.memberTop}>
                        <ProfileAvatar avatarUrl={member.user.avatarUrl} nickname={member.displayName ?? member.user.nickname} size="sm" />
                        <View style={styles.memberCopy}>
                          <Text style={styles.memberName}>
                            {member.displayName ?? member.user.nickname ?? '小提督搭子'} {isMe ? '（我）' : ''}
                          </Text>
                          <Text style={styles.memberStatus}>{member.status === 'paused' ? '暂停共享中' : formatSnapshot(snapshot)}</Text>
                        </View>
                        {member.status === 'paused' ? <PauseCircle color={colors.warning} size={20} strokeWidth={2.4} /> : null}
                      </View>
                      {!isMe ? (
                        <AppButton
                          disabled={!isPro}
                          onPress={() => void sendNudge(member.user.id, 'move')}
                          style={styles.nudgeButton}
                          variant="secondary"
                        >
                          轻轻戳一下
                        </AppButton>
                      ) : null}
                    </PressableScale>
                  );
                })}
            </PageSection>
          </>
        ) : null}

        {error || nudgeError ? <Text style={styles.errorText}>{error ?? nudgeError}</Text> : null}
        {isLoading ? <Text style={styles.loadingText}>小队状态加载中...</Text> : null}
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    },
    flexButton: {
      flex: 1,
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
      textAlign: 'center',
    },
    memberCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
    },
    memberCopy: {
      flex: 1,
    },
    memberName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 4,
    },
    memberStatus: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    memberTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    nudgeButton: {
      marginTop: 14,
      minHeight: 42,
    },
    teamActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    teamHeader: {
      gap: 4,
    },
    teamMeta: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 4,
    },
    teamName: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    teamTitleLine: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    weeklyCard: {
      backgroundColor: colors.surfaceMuted,
      gap: 6,
    },
    weeklyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}

function formatSnapshot(snapshot: TeamSnapshot | undefined) {
  if (!snapshot || !snapshot.snapshot) {
    return '还没共享今日状态';
  }

  const data = snapshot.snapshot;
  const parts = [
    data.trainingDone === undefined ? null : data.trainingDone ? '小花已营业' : '小花待营业',
    data.habitCompletion === undefined ? null : `小账本 ${data.habitCompletion}/4`,
    data.toiletRecorded === undefined ? null : data.toiletRecorded ? '蹲会儿已记' : '蹲会儿未记',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '今天低调共享中';
}
