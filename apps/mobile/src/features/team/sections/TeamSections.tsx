import { Text, View } from 'react-native';
import { ChevronRight, PauseCircle } from 'lucide-react-native';
import type { TeamMember, TeamSnapshot } from '@xiaotidu/contracts';

import { PressableScale } from '../../../components/feedback/PressableScale';
import { ProfileAvatar } from '../../../components/ProfileAvatar';
import { getDisplayName, type NudgeThread } from '../../nudges/nudgeModel';
import { formatThreadTime, getBuddyPrimaryText, getBuddySecondaryText } from '../teamPresentation';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/teamStyles';

type BuddyConversationRowProps = {
  isLast: boolean;
  member: TeamMember;
  onPress: () => void;
  snapshot?: TeamSnapshot['snapshot'];
  thread?: NudgeThread;
};

export function BuddyConversationRow({ isLast, member, onPress, snapshot, thread }: BuddyConversationRowProps) {
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
