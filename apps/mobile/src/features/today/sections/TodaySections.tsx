import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { Bell, ChevronRight, UsersRound } from 'lucide-react-native';
import type { Team, TeamSnapshotsResponse } from '@xiaotidu/contracts';

import { PressableScale } from '../../../components/feedback/PressableScale';
import type { NudgeHomeSummary } from '../../nudges/nudgeModel';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/todayStyles';

type TeamHomeCardProps = {
  error: null | string;
  isLoading: boolean;
  nudgeSummary: NudgeHomeSummary;
  onPress: () => void;
  snapshots: TeamSnapshotsResponse | null;
  team: Team | null;
};

export function TeamHomeCard({ error, isLoading, nudgeSummary, onPress, snapshots, team }: TeamHomeCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const activeMembers = team?.members.filter((member) => member.status !== 'removed') ?? [];
  const title = team?.name ?? '还没有监督搭子';
  const memberLabel =
    nudgeSummary.pendingCount > 0
      ? `${nudgeSummary.pendingCount} 待回`
      : team
        ? `成员 ${activeMembers.length}/4`
        : '小队';
  const description = getTeamHomeDescription({
    activeMemberCount: activeMembers.length,
    error,
    isLoading,
    nudgeSummary,
    snapshots,
    team,
  });

  return (
    <PressableScale accessibilityLabel={`监督搭子，${description}`} onPress={onPress} style={styles.teamHomeCard}>
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
  nudgeSummary: NudgeHomeSummary;
  snapshots: TeamSnapshotsResponse | null;
  team: Team | null;
};

function getTeamHomeDescription({
  activeMemberCount,
  error,
  isLoading,
  nudgeSummary,
  snapshots,
  team,
}: TeamHomeDescriptionInput) {
  if (error) {
    return '暂时无法同步小队状态，点进去再试试。';
  }

  if (!team) {
    return '进去创建小队或处理邀请，先把搭子关系建起来。';
  }

  if (nudgeSummary.pendingCount > 0) {
    return `${nudgeSummary.pendingCount} 条搭子提醒待回应`;
  }

  if (nudgeSummary.latestPreview) {
    return nudgeSummary.latestPreview;
  }

  if (isLoading && !snapshots) {
    return '小队状态同步中...';
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

export function ReminderSetupPrompt({ onPress }: ReminderSetupPromptProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale accessibilityLabel="小暗号还没安排，去设置隐私提醒" onPress={onPress} style={styles.reminderPrompt}>
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

export function CompactActionRow({ description, icon: Icon, onPress, title }: RowActionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale accessibilityLabel={`${title}，${description}`} onPress={onPress} style={styles.actionRow}>
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

export function OverviewMetric({ label, status, value }: OverviewMetricProps) {
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

export function UtilityLink({ description, icon: Icon, iconColor, iconTone, onPress, title }: UtilityLinkProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <PressableScale accessibilityLabel={`${title}，${description}`} onPress={onPress} style={styles.utilityRow}>
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
