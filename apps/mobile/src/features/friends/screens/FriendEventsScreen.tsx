import { useRouter } from 'expo-router';
import { BellRing, MessageCircle, TimerReset, UserRound } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { FriendEvent, FriendNudgeAckStatus, FriendNudgeType } from '@xiaotidu/contracts';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { ProfileAvatar } from '../../../components/ProfileAvatar';
import { Screen } from '../../../components/Screen';
import { useCurrentUserQuery } from '../../account/accountQueries';
import { routes } from '../../../navigation/routes';
import { useForegroundFocus } from '../../../navigation/useForegroundFocus';
import { useAppTheme } from '../../../theme/themeProvider';
import {
  useAckFriendNudgeMutation,
  useFriendEventsQuery,
  useFriendQuery,
  useSendFriendNudgeMutation,
} from '../friendQueries';

const pollIntervalMs = 10_000;
const nudgeTypes: FriendNudgeType[] = ['gentle', 'move', 'not_blank', 'habit_left', 'posture'];
const nudgeCopies: Record<FriendNudgeType, string> = {
  gentle: '轻轻戳一下',
  habit_left: '补一笔小账',
  move: '走两步',
  not_blank: '留个小进展',
  posture: '肩颈放松',
};
const ackStatuses: FriendNudgeAckStatus[] = ['received', 'later', 'done'];
const ackCopies: Record<FriendNudgeAckStatus, string> = {
  done: '已完成',
  later: '等会儿',
  received: '收到',
};

export default function FriendEventsScreen({ friendUserId }: { friendUserId?: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const currentUser = useCurrentUserQuery().data;
  const { isAppActive, isFocused } = useForegroundFocus();
  const shouldPoll = Boolean(currentUser && friendUserId && isAppActive && isFocused);
  const friendQuery = useFriendQuery(friendUserId);
  const eventsQuery = useFriendEventsQuery(friendUserId, {
    refetchInterval: shouldPoll ? pollIntervalMs : false,
  });
  const sendNudge = useSendFriendNudgeMutation(friendUserId);
  const ackNudge = useAckFriendNudgeMutation(friendUserId);
  const detail = friendQuery.data?.friend;
  const friend = detail?.friend;
  const name = friend?.nickname ?? '好友互动';
  const canSend = Boolean(
    friendUserId && detail?.friendSettings.nudgesEnabled && detail.friendSettings.nudgeDailyLimit > 0,
  );
  const isMutating = sendNudge.isPending || ackNudge.isPending;

  const renderEvent = useCallback(
    ({ item }: { item: FriendEvent }) => (
      <EventRow
        currentUserId={currentUser?.id}
        event={item}
        isMutating={isMutating}
        onAck={(status) => ackNudge.mutate({ eventId: item.id, status })}
      />
    ),
    [ackNudge, currentUser?.id, isMutating],
  );

  return (
    <Screen bottomSafeArea contentStyle={styles.screen} scroll={false}>
      <AppTopBar
        fallbackHref={routes.friends}
        right={
          friendUserId ? (
            <PressableScale
              accessibilityLabel="查看好友资料"
              onPress={() => router.push(routes.friend(friendUserId))}
              style={styles.iconButton}
            >
              <UserRound color={colors.text} size={20} strokeWidth={2.4} />
            </PressableScale>
          ) : null
        }
        title={name}
      />

      <View style={styles.content}>
        {!currentUser ? (
          <AppCard style={styles.emptyCard}>
            <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>先登录小提督</Text>
            <Text style={styles.emptyText}>登录后才能查看好友互动。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去登录</AppButton>
          </AppCard>
        ) : null}

        {currentUser && friendQuery.isPending ? <Text style={styles.loadingText}>正在同步好友互动...</Text> : null}

        {currentUser && friendQuery.error ? (
          <AppCard style={styles.emptyCard}>
            <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>没有找到这个好友</Text>
            <Text style={styles.emptyText}>{friendQuery.error.message}</Text>
            <AppButton onPress={() => router.replace(routes.friends)}>回到好友列表</AppButton>
          </AppCard>
        ) : null}

        {currentUser && detail ? (
          <View style={styles.timelineShell}>
            <View style={styles.friendHeader}>
              <ProfileAvatar avatarUrl={friend?.avatarUrl ?? null} nickname={name} size="sm" />
              <View style={styles.friendHeaderCopy}>
                <Text style={styles.friendName}>{name}</Text>
                <Text style={styles.friendHint}>提醒和蹲会儿结束消息都会保留在这里。</Text>
              </View>
            </View>

            <FlatList
              contentContainerStyle={styles.eventContent}
              data={eventsQuery.items}
              keyExtractor={(event) => event.id}
              ListEmptyComponent={
                <View style={styles.emptyTimeline}>
                  <BellRing color={colors.privacy} size={28} strokeWidth={2.4} />
                  <Text style={styles.emptyTitle}>还没有互动</Text>
                  <Text style={styles.emptyText}>选一个固定暗号，轻轻开个头。</Text>
                </View>
              }
              ListHeaderComponent={
                eventsQuery.hasNextPage ? (
                  <AppButton
                    disabled={eventsQuery.isFetchingNextPage}
                    onPress={() => void eventsQuery.fetchNextPage()}
                    style={styles.olderButton}
                    variant="secondary"
                  >
                    {eventsQuery.isFetchingNextPage ? '加载中...' : '加载更早互动'}
                  </AppButton>
                ) : null
              }
              renderItem={renderEvent}
              showsVerticalScrollIndicator={false}
              style={styles.eventList}
            />

            <View style={styles.composer}>
              <Text style={styles.composerTitle}>发个固定暗号</Text>
              {!canSend ? <Text style={styles.composerHint}>TA 当前关闭了好友提醒或每日上限为 0。</Text> : null}
              <View style={styles.nudgeGrid}>
                {nudgeTypes.map((type) => (
                  <AppButton
                    disabled={!canSend || isMutating}
                    key={type}
                    onPress={() => sendNudge.mutate(type)}
                    style={styles.nudgeButton}
                    variant="secondary"
                  >
                    {nudgeCopies[type]}
                  </AppButton>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function EventRow({
  currentUserId,
  event,
  isMutating,
  onAck,
}: {
  currentUserId?: string;
  event: FriendEvent;
  isMutating: boolean;
  onAck: (status: FriendNudgeAckStatus) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isOutgoing = event.fromUser.id === currentUserId;

  if (event.kind === 'toilet_finished') {
    return (
      <View style={styles.systemEvent}>
        <TimerReset color={colors.privacy} size={17} strokeWidth={2.4} />
        <View style={styles.systemCopy}>
          <Text style={styles.systemText}>
            {isOutgoing ? '你' : (event.fromUser.nickname ?? '好友')}刚结束蹲会儿
            {event.durationSeconds === null ? '' : ` · ${formatDuration(event.durationSeconds)}`}
          </Text>
          <Text style={styles.eventTime}>{formatEventTime(event.occurredAt)}</Text>
        </View>
      </View>
    );
  }

  const canAck = !isOutgoing && !event.ack && new Date(event.expiresAt).getTime() > Date.now();
  const ackLabel = event.ack ? `${isOutgoing ? '对方' : '我'}${ackCopies[event.ack.status]}` : null;
  return (
    <View style={[styles.eventRow, isOutgoing ? styles.eventRowOutgoing : styles.eventRowIncoming]}>
      <ProfileAvatar
        avatarUrl={event.fromUser.avatarUrl}
        nickname={event.fromUser.nickname ?? (isOutgoing ? '我' : '好友')}
        size="sm"
      />
      <View style={[styles.bubbleGroup, isOutgoing ? styles.bubbleGroupOutgoing : styles.bubbleGroupIncoming]}>
        <View style={[styles.bubble, isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
          <Text style={[styles.bubbleText, isOutgoing ? styles.bubbleTextOutgoing : null]}>{event.message}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.eventTime, isOutgoing ? styles.eventTimeOutgoing : null]}>
              {formatEventTime(event.occurredAt)}
            </Text>
            {ackLabel ? (
              <Text style={[styles.ackTag, isOutgoing ? styles.ackTagOutgoing : null]}>{ackLabel}</Text>
            ) : null}
          </View>
        </View>
        {canAck ? (
          <View style={styles.ackActions}>
            {ackStatuses.map((status) => (
              <AppButton
                disabled={isMutating}
                key={status}
                onPress={() => onAck(status)}
                style={styles.ackButton}
                variant="secondary"
              >
                {ackCopies[status]}
              </AppButton>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatDuration(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'numeric',
  }).format(new Date(value));
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ackActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
    ackButton: { minHeight: 36, paddingHorizontal: 10 },
    ackTag: { color: colors.primaryPressed, fontSize: 11, fontWeight: '900' },
    ackTagOutgoing: { color: '#FFFFFF' },
    bubble: { borderRadius: 14, gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleGroup: { maxWidth: '78%' },
    bubbleGroupIncoming: { alignItems: 'flex-start' },
    bubbleGroupOutgoing: { alignItems: 'flex-end' },
    bubbleIncoming: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
    bubbleOutgoing: { backgroundColor: colors.primary },
    bubbleText: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 21 },
    bubbleTextOutgoing: { color: '#FFFFFF' },
    composer: { borderTopColor: colors.border, borderTopWidth: 1, gap: 9, paddingBottom: 6, paddingTop: 12 },
    composerHint: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    composerTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    content: { flex: 1, paddingHorizontal: 16 },
    emptyCard: { alignItems: 'center', gap: 12 },
    emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
    emptyTimeline: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', paddingVertical: 28 },
    emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
    eventContent: { flexGrow: 1, gap: 12, justifyContent: 'flex-end', paddingBottom: 16, paddingTop: 10 },
    eventList: { flex: 1 },
    eventRow: { alignItems: 'flex-start', gap: 8 },
    eventRowIncoming: { flexDirection: 'row' },
    eventRowOutgoing: { flexDirection: 'row-reverse' },
    eventTime: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
    eventTimeOutgoing: { color: 'rgba(255,255,255,0.78)' },
    friendHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingBottom: 8, paddingTop: 4 },
    friendHeaderCopy: { flex: 1, gap: 2 },
    friendHint: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    friendName: { color: colors.text, fontSize: 16, fontWeight: '900' },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
    nudgeButton: { flexBasis: '47%', flexGrow: 1, minHeight: 40, paddingHorizontal: 8 },
    nudgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    olderButton: { minHeight: 38 },
    screen: { flex: 1 },
    systemCopy: { flex: 1, gap: 2 },
    systemEvent: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      maxWidth: '88%',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    systemText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
    timelineShell: { flex: 1 },
  });
}
