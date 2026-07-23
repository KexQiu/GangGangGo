import { useRouter } from 'expo-router';
import { ChevronRight, RefreshCw, UserPlus, UsersRound } from 'lucide-react-native';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import type { FriendSummary } from '@xiaotidu/contracts';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { PageHeader } from '../../../components/PageHeader';
import { PageSection, PageStack } from '../../../components/PageStack';
import { ProfileAvatar } from '../../../components/ProfileAvatar';
import { Screen } from '../../../components/Screen';
import { useCurrentUserQuery } from '../../account/accountQueries';
import { useFriendsQuery } from '../friendQueries';
import { createFriendStyles } from '../styles/friendStyles';
import { routes } from '../../../navigation/routes';
import { useForegroundFocus } from '../../../navigation/useForegroundFocus';
import { useAppTheme } from '../../../theme/themeProvider';

const pollIntervalMs = 10_000;

export default function FriendsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createFriendStyles(colors);
  const user = useCurrentUserQuery().data;
  const { isAppActive, isFocused } = useForegroundFocus();
  const shouldPoll = Boolean(user && isAppActive && isFocused);
  const friendsQuery = useFriendsQuery({ refetchInterval: shouldPoll ? pollIntervalMs : false });
  const friends = friendsQuery.data?.friends ?? [];
  const pendingCount = friends.reduce((total, friend) => total + friend.pendingCount, 0);
  const refresh = useCallback(() => void friendsQuery.refetch(), [friendsQuery]);

  return (
    <Screen>
      <PageHeader subtitle="每段关系单独授权，默认不共享任何健康数据。" title="好友" />
      <PageStack gap="regular">
        {!user ? (
          <AppCard style={styles.emptyCard}>
            <UsersRound color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>先登录小提督</Text>
            <Text style={styles.emptyBody}>登录后才能添加好友、配置权限和接收提醒。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去登录</AppButton>
          </AppCard>
        ) : null}

        {user ? (
          <AppCard style={styles.headerCard}>
            <View style={styles.headerLine}>
              <View>
                <Text style={styles.headerText}>{friends.length}/20 位好友</Text>
                <Text style={styles.statText}>
                  {pendingCount > 0 ? `${pendingCount} 条提醒待回应` : '权限由你逐个决定'}
                </Text>
              </View>
              <View style={styles.trailing}>
                <PressableScale accessibilityLabel="刷新好友" onPress={refresh} style={styles.actionButton}>
                  <RefreshCw color={colors.text} size={19} strokeWidth={2.4} />
                </PressableScale>
                <PressableScale
                  accessibilityLabel="添加好友"
                  onPress={() => router.push(routes.friendInvite)}
                  style={styles.actionButton}
                >
                  <UserPlus color={colors.text} size={19} strokeWidth={2.4} />
                </PressableScale>
              </View>
            </View>
          </AppCard>
        ) : null}

        {user ? (
          <PageSection subtitle="查看授权状态、近期互动和今日概览。" title="我的好友">
            {friends.length === 0 ? (
              <AppCard style={styles.emptyCard}>
                <UserPlus color={colors.privacy} size={28} strokeWidth={2.4} />
                <Text style={styles.emptyTitle}>还没有好友</Text>
                <Text style={styles.emptyBody}>分享一次性邀请，对方确认后就会出现在这里。</Text>
                <AppButton onPress={() => router.push(routes.friendInvite)}>添加好友</AppButton>
              </AppCard>
            ) : (
              <View style={styles.friendList}>
                {friends.map((friend, index) => (
                  <FriendRow
                    friend={friend}
                    isLast={index === friends.length - 1}
                    key={friend.friendshipId}
                    onPress={() => router.push(routes.friendEvents(friend.friend.id))}
                  />
                ))}
              </View>
            )}
          </PageSection>
        ) : null}

        {friendsQuery.error ? <Text style={styles.errorText}>{friendsQuery.error.message}</Text> : null}
        {friendsQuery.isFetching ? <Text style={styles.loadingText}>好友同步中...</Text> : null}
      </PageStack>
    </Screen>
  );
}

function FriendRow({ friend, isLast, onPress }: { friend: FriendSummary; isLast: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = createFriendStyles(colors);
  const name = friend.friend.nickname ?? '小提督好友';
  return (
    <PressableScale
      accessibilityLabel={`${name}，${eventPreview(friend)}`}
      onPress={onPress}
      style={[styles.friendRow, isLast ? styles.friendRowLast : null]}
    >
      <ProfileAvatar avatarUrl={friend.friend.avatarUrl} nickname={name} size="sm" />
      <View style={styles.friendCopy}>
        <View style={styles.headerTitleLine}>
          <Text numberOfLines={1} style={styles.friendName}>
            {name}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.friendPreview}>
          {eventPreview(friend)}
        </Text>
        <Text numberOfLines={1} style={styles.friendStatus}>
          {dataPreview(friend)}
        </Text>
      </View>
      <View style={styles.trailing}>
        {friend.pendingCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{friend.pendingCount}</Text>
          </View>
        ) : null}
        <ChevronRight color={colors.textSubtle} size={18} strokeWidth={2.4} />
      </View>
    </PressableScale>
  );
}

function eventPreview(friend: FriendSummary) {
  const event = friend.latestEvent;
  if (!event) return '还没有互动';
  if (event.kind === 'manual_nudge') return event.message;
  return event.durationSeconds === null
    ? '刚结束一次蹲会儿'
    : `刚结束蹲会儿 · ${Math.max(1, Math.round(event.durationSeconds / 60))} 分钟`;
}

function dataPreview(friend: FriendSummary) {
  const preview = friend.dataPreview;
  const parts = [
    preview.trainingDone === null ? null : preview.trainingDone ? '菊花抬已达标' : '菊花抬未达标',
    preview.habitCompletion === null ? null : `小账本 ${preview.habitCompletion}/4`,
    preview.toiletRecorded === null ? null : preview.toiletRecorded ? '蹲会儿已记' : '蹲会儿未记',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'TA 暂未授权今日数据';
}
