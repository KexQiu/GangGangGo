import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, type ComponentType } from 'react';
import {
  Bell,
  ChevronRight,
  CheckCircle2,
  ChartNoAxesColumnIncreasing,
  Hourglass,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import type { Team, TeamSnapshotsResponse } from '@xiaotidu/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { PressableScale } from '../src/components/feedback/PressableScale';
import { PageHeader } from '../src/components/PageHeader';
import { Screen } from '../src/components/Screen';
import { useAuthStore } from '../src/features/account/authStore';
import {
  calculateHabitCompletion,
  createEmptyHabitCheckIn,
  getLocalDateKey,
} from '../src/features/habits/habitLogic';
import { getHabitCheckInForDate, useHabitStore } from '../src/features/habits/habitStore';
import { HabitQuickCheckInCard } from '../src/features/habits/HabitQuickCheckInCard';
import { getReminderHomeSummary, hasAnyReminderEnabled } from '../src/features/reminders/reminderLogic';
import { useReminderStore } from '../src/features/reminders/reminderStore';
import {
  getHabitStatusLabel,
  getTodayPositiveFeedback,
  getToiletStatusLabel,
  getTrainingStatusLabel,
} from '../src/features/today/todayFeedback';
import { useTeamStore } from '../src/features/team/teamStore';
import { getTodayToiletSessionCount, useToiletStore } from '../src/features/toilet/toiletStore';
import { FlowerLiftIcon } from '../src/features/training/FlowerLiftIcon';
import { getTodayCompletedTrainingCount, useTrainingStore } from '../src/features/training/trainingStore';
import { buildSevenDayTrend } from '../src/features/trends/trendLogic';
import { routes } from '../src/navigation/routes';
import { useAppTheme } from '../src/theme/themeProvider';

const trainingTarget = 2;

export default function HomeScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const checkIns = useHabitStore((state) => state.checkIns);
  const reminderSettings = useReminderStore((state) => state.settings);
  const toiletSessions = useToiletStore((state) => state.sessions);
  const trainingSessions = useTrainingStore((state) => state.sessions);
  const team = useTeamStore((state) => state.team);
  const teamError = useTeamStore((state) => state.error);
  const teamIsLoading = useTeamStore((state) => state.isLoading);
  const teamSnapshots = useTeamStore((state) => state.snapshots);
  const loadCurrentTeam = useTeamStore((state) => state.loadCurrentTeam);
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

  const refreshTeamHomeCard = useCallback(() => {
    if (!accessToken) {
      void loadCurrentTeam();
      return;
    }

    if (!userId) {
      return;
    }

    void loadCurrentTeam();
  }, [accessToken, loadCurrentTeam, userId]);

  useFocusEffect(refreshTeamHomeCard);

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
          error={teamError}
          isLoading={teamIsLoading}
          onPress={() => router.push(routes.team)}
          snapshots={teamSnapshots}
          team={team}
        />
      ) : null}

      {!hasReminderEnabled ? <ReminderSetupPrompt onPress={() => router.push(routes.reminders)} /> : null}

      <AppCard muted style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{todayTrainingCount >= trainingTarget ? '今日小花已下班' : '今日菊花抬'}</Text>
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
          description={`这周小花营业 ${sevenDayTrend.trainingActiveDays} 天，小账本满格 ${sevenDayTrend.habitFullDays} 天。`}
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

type TeamHomeCardProps = {
  error: null | string;
  isLoading: boolean;
  onPress: () => void;
  snapshots: TeamSnapshotsResponse | null;
  team: Team | null;
};

function TeamHomeCard({ error, isLoading, onPress, snapshots, team }: TeamHomeCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const activeMembers = team?.members.filter((member) => member.status !== 'removed') ?? [];
  const title = team?.name ?? '还没有监督搭子';
  const memberLabel = team ? `成员 ${activeMembers.length}/4` : '小队';
  const description = getTeamHomeDescription({
    activeMemberCount: activeMembers.length,
    error,
    isLoading,
    snapshots,
    team,
  });

  return (
    <PressableScale
      accessibilityLabel={`监督搭子，${description}`}
      onPress={onPress}
      style={styles.teamHomeCard}
    >
      <View style={styles.teamHomeIcon}>
        <UsersRound color={colors.privacy} size={21} strokeWidth={2.4} />
      </View>
      <View style={styles.teamHomeCopy}>
        <View style={styles.teamHomeTitleRow}>
          <Text numberOfLines={1} style={styles.teamHomeTitle}>
            {title}
          </Text>
          <Text style={styles.teamHomePill}>{memberLabel}</Text>
        </View>
        <Text style={styles.teamHomeDescription}>{description}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={18} strokeWidth={2.4} />
    </PressableScale>
  );
}

type TeamHomeDescriptionInput = {
  activeMemberCount: number;
  error: null | string;
  isLoading: boolean;
  snapshots: TeamSnapshotsResponse | null;
  team: Team | null;
};

function getTeamHomeDescription({ activeMemberCount, error, isLoading, snapshots, team }: TeamHomeDescriptionInput) {
  if (isLoading && !snapshots) {
    return '小队状态同步中...';
  }

  if (error) {
    return '暂时无法同步小队状态，点进去再试试。';
  }

  if (!team) {
    return '进去创建小队或处理邀请，先把搭子关系建起来。';
  }

  if (!snapshots) {
    return '打开小队查看今日状态。';
  }

  const activeSnapshotCount = snapshots.snapshots.filter((item) => {
    return item.member.status !== 'removed' && item.snapshot !== null;
  }).length;
  const pausedCount = team.members.filter((member) => member.status === 'paused').length;
  const parts = [`今日已同步 ${activeSnapshotCount}/${activeMemberCount} 人`];

  if (pausedCount > 0) {
    parts.push(`${pausedCount} 人暂停共享`);
  }

  return parts.join(' · ');
}

type ReminderSetupPromptProps = {
  onPress: () => void;
};

function ReminderSetupPrompt({ onPress }: ReminderSetupPromptProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale
      accessibilityLabel="小暗号还没安排，去设置隐私提醒"
      onPress={onPress}
      style={styles.reminderPrompt}
    >
      <View style={styles.reminderPromptIcon}>
        <Bell color={colors.privacy} size={21} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.reminderPromptTitle}>小暗号还没安排</Text>
        <Text style={styles.reminderPromptText}>设置一下，App 会用隐私文案轻轻提醒，不在通知栏大声广播。</Text>
      </View>
      <View style={styles.reminderPromptCta}>
        <Text style={styles.reminderPromptCtaText}>去安排</Text>
      </View>
    </PressableScale>
  );
}

type RowActionProps = {
  description: string;
  icon: IconComponent;
  onPress: () => void;
  title: string;
};

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

function CompactActionRow({ description, icon: Icon, onPress, title }: RowActionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale
      accessibilityLabel={`${title}，${description}`}
      onPress={onPress}
      style={styles.actionRow}
    >
      <View style={[styles.rowIcon, styles.infoBadge]}>
        <Icon color={colors.info} size={22} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.mutedText}>{description}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
    </PressableScale>
  );
}

type OverviewMetricProps = {
  label: string;
  status: string;
  value: string;
};

function OverviewMetric({ label, status, value }: OverviewMetricProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricTag}>{status}</Text>
    </View>
  );
}

type UtilityLinkProps = RowActionProps & {
  iconColor: string;
  iconTone: string;
};

function UtilityLink({ description, icon: Icon, iconColor, iconTone, onPress, title }: UtilityLinkProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale
      accessibilityLabel={`${title}，${description}`}
      onPress={onPress}
      style={styles.utilityRow}
    >
      <View style={[styles.utilityIcon, { backgroundColor: iconTone }]}>
        <Icon color={iconColor} size={19} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.utilityTitle}>{title}</Text>
        <Text style={styles.utilityText}>{description}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={18} strokeWidth={2.4} />
    </PressableScale>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    headerCopy: {
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
      marginLeft: 12,
      marginTop: 4,
    },
    headerButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    overviewCard: {
      marginBottom: 12,
      padding: 16,
    },
    overviewHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 12,
    },
    feedbackIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 10,
      width: 34,
    },
    feedbackCopy: {
      flex: 1,
    },
    feedbackTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 3,
    },
    overviewMetrics: {
      flexDirection: 'row',
      gap: 8,
    },
    metricItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 15,
      flex: 1,
      paddingHorizontal: 7,
      paddingVertical: 9,
    },
    metricValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
      textAlign: 'center',
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 5,
      textAlign: 'center',
    },
    metricTag: {
      alignSelf: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      color: colors.primaryPressed,
      fontSize: 10,
      fontWeight: '800',
      overflow: 'hidden',
      paddingHorizontal: 7,
      paddingVertical: 3,
      textAlign: 'center',
    },
    reminderPrompt: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    reminderPromptIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      marginRight: 11,
      width: 36,
    },
    reminderPromptTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 3,
    },
    reminderPromptText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    reminderPromptCta: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      marginLeft: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    reminderPromptCtaText: {
      color: colors.privacy,
      fontSize: 12,
      fontWeight: '800',
    },
    teamHomeCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 12,
      padding: 14,
    },
    teamHomeCopy: {
      flex: 1,
      marginRight: 10,
    },
    teamHomeDescription: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    teamHomeIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 19,
      height: 38,
      justifyContent: 'center',
      marginRight: 12,
      width: 38,
    },
    teamHomePill: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      color: colors.primaryPressed,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '800',
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    teamHomeTitle: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '900',
      marginRight: 8,
    },
    teamHomeTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 4,
    },
    heroCard: {
      borderRadius: 24,
      marginBottom: 12,
      padding: 18,
    },
    heroTop: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 14,
    },
    heroCopy: {
      flex: 1,
      marginRight: 14,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
    },
    mutedText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
    },
    ringOuter: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },
    ringInner: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 27,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    actionRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 12,
      padding: 14,
    },
    rowIcon: {
      alignItems: 'center',
      borderRadius: 19,
      height: 38,
      justifyContent: 'center',
      marginRight: 12,
      width: 38,
    },
    infoBadge: {
      backgroundColor: colors.infoSoft,
    },
    rowCopy: {
      flex: 1,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 3,
    },
    toolCard: {
      marginTop: 12,
      padding: 6,
    },
    utilityRow: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 58,
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    utilityIcon: {
      alignItems: 'center',
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 10,
      width: 34,
    },
    utilityTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 3,
    },
    utilityText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    toolDivider: {
      backgroundColor: colors.border,
      height: 1,
      marginHorizontal: 8,
    },
  });
}
