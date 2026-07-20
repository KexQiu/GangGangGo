import { MessageBubble, NudgeActionDrawer } from '../sections/NudgeThreadSections';
import { createStyles } from '../styles/nudgeThreadStyles';
import { useFocusEffect, useRouter } from 'expo-router';
import { MessageCircle, SendHorizonal, UserRound, UsersRound } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { queryClient } from '../../../api/queryClient';
import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { AppTopBar } from '../../../components/AppTopBar';
import { PressableScale } from '../../../components/feedback/PressableScale';
import { Screen } from '../../../components/Screen';
import { defaultProStatus, isProStatus } from '../../../features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../../features/account/accountQueries';
import { useAuthStore } from '../../../features/account/authStore';
import {
  getDisplayName,
  getNudgeChatMessages,
  nudgeActionTypes,
  type NudgeChatMessage,
} from '../../../features/nudges/nudgeModel';
import { getDisabledSendReason } from '../../../features/nudges/nudgePresentation';
import { nudgePollIntervalMs, shouldPollNudges } from '../../../features/nudges/nudgePolling';
import { cancelNudgeQueries } from '../../../features/nudges/nudgeQueryCache';
import {
  useAckNudgeMutation,
  useNudgeThreadQuery,
  useNudgeThreadsQuery,
  useSendNudgeMutation,
} from '../../../features/nudges/nudgeQueries';
import { useCurrentTeamQuery } from '../../../features/team/teamQueries';
import { routes } from '../../../navigation/routes';
import { useForegroundFocus } from '../../../navigation/useForegroundFocus';
import { useAppTheme } from '../../../theme/themeProvider';

export default function NudgeChatScreen({ buddyUserId }: { buddyUserId?: string }) {
  const router = useRouter();
  const scrollRef = useRef<FlatList<NudgeChatMessage>>(null);
  const didInitialScrollRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const lastContentHeightRef = useRef(0);
  const pendingOlderLoadRef = useRef(false);
  const [isActionDrawerVisible, setIsActionDrawerVisible] = useState(false);
  const { isAppActive, isFocused } = useForegroundFocus();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useCurrentUserQuery().data;
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const isPollingEnabled = shouldPollNudges({
    hasSession: Boolean(accessToken && currentUser?.id),
    hasTarget: Boolean(buddyUserId),
    isAppActive,
    isFocused,
  });
  const threadQuery = useNudgeThreadQuery(buddyUserId, {
    enabled: isPollingEnabled,
    refetchInterval: isPollingEnabled ? nudgePollIntervalMs : false,
  });
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending: isThreadPending,
    items: threadItems,
  } = threadQuery;
  useNudgeThreadsQuery({
    enabled: isPollingEnabled,
    refetchInterval: isPollingEnabled ? nudgePollIntervalMs : false,
  });
  const ackNudge = useAckNudgeMutation(buddyUserId);
  const sendNudge = useSendNudgeMutation(buddyUserId);
  const isMutating = ackNudge.isPending || sendNudge.isPending;
  const {
    data: teamData,
    isFetching: isFetchingTeam,
    refetch: refetchTeam,
  } = useCurrentTeamQuery({ enabled: Boolean(accessToken && currentUser?.id) });
  const team = teamData?.team;
  const member = team?.members.find((item) => item.user.id === buddyUserId);
  const messages = useMemo(
    () =>
      getNudgeChatMessages({
        currentUserId: currentUser?.id,
        nudges: threadItems,
      }),
    [currentUser?.id, threadItems],
  );
  const fallbackBuddy = messages[0]?.direction === 'incoming' ? messages[0].sender : messages[0]?.nudge.toUser;
  const buddy = member?.user ?? fallbackBuddy;
  const isPro = isProStatus(proStatus);
  const canSend = Boolean(buddyUserId && isPro && member?.status === 'active');
  const isThreadBootstrapping = Boolean(isPollingEnabled && isThreadPending);
  const isSyncing = Boolean(isFetchingTeam || isThreadBootstrapping);
  const disabledSendReason = getDisabledSendReason({
    isPro,
    memberStatus: member?.status,
    userId: buddyUserId,
  });

  useFocusEffect(
    useCallback(() => {
      didInitialScrollRef.current = false;
      shouldStickToBottomRef.current = true;
      if (accessToken) void refetchTeam();
      return () => {
        if (currentUser?.id && buddyUserId) {
          void cancelNudgeQueries(queryClient, currentUser.id, buddyUserId);
        }
      };
    }, [accessToken, buddyUserId, currentUser?.id, refetchTeam]),
  );

  useEffect(() => {
    if (isPollingEnabled || !currentUser?.id || !buddyUserId) return;
    void cancelNudgeQueries(queryClient, currentUser.id, buddyUserId);
  }, [buddyUserId, currentUser?.id, isPollingEnabled]);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    if (pendingOlderLoadRef.current) {
      const offsetDelta = Math.max(height - lastContentHeightRef.current, 0);
      scrollRef.current?.scrollToOffset({ animated: false, offset: offsetDelta });
      pendingOlderLoadRef.current = false;
      lastContentHeightRef.current = height;
      return;
    }

    lastContentHeightRef.current = height;

    if (!didInitialScrollRef.current || shouldStickToBottomRef.current) {
      scrollRef.current?.scrollToEnd({ animated: didInitialScrollRef.current });
      didInitialScrollRef.current = true;
    }
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      shouldStickToBottomRef.current = distanceFromBottom < 80;
      lastContentHeightRef.current = contentSize.height;

      if (!buddyUserId || !hasNextPage || isFetchingNextPage || pendingOlderLoadRef.current) {
        return;
      }

      if (contentOffset.y < 32) {
        const itemCountBeforeLoad = threadItems.length;
        pendingOlderLoadRef.current = true;
        void fetchNextPage()
          .then((result) => {
            const itemCountAfterLoad = new Set(
              result.data?.pages.flatMap((page) => page.nudges.map((nudge) => nudge.id)),
            ).size;
            if (result.isError || itemCountAfterLoad <= itemCountBeforeLoad) pendingOlderLoadRef.current = false;
          })
          .catch(() => {
            pendingOlderLoadRef.current = false;
          });
      }
    },
    [buddyUserId, fetchNextPage, hasNextPage, isFetchingNextPage, threadItems.length],
  );

  const handleSendNudge = useCallback(
    (type: (typeof nudgeActionTypes)[number]) => {
      if (!buddyUserId) {
        return;
      }

      shouldStickToBottomRef.current = true;
      setIsActionDrawerVisible(false);
      sendNudge.mutate(type);
    },
    [buddyUserId, sendNudge],
  );

  const renderMessage = useCallback(
    ({ item: message }: { item: NudgeChatMessage }) => (
      <MessageBubble
        buddyUserId={buddyUserId}
        isMutating={isMutating}
        message={message}
        onAck={(status) => ackNudge.mutate({ id: message.nudge.id, status })}
      />
    ),
    [ackNudge, buddyUserId, isMutating],
  );

  return (
    <Screen bottomSafeArea contentStyle={styles.screen} scroll={false}>
      <AppTopBar
        fallbackHref={routes.team}
        right={
          buddyUserId ? (
            <PressableScale
              accessibilityLabel="查看搭子详情"
              onPress={() => router.push(`/team/member/${buddyUserId}`)}
              style={styles.topBarIconButton}
            >
              <UserRound color={colors.text} size={20} strokeWidth={2.4} />
            </PressableScale>
          ) : null
        }
        title={buddy ? getDisplayName(buddy) : '搭子互动'}
      />

      <View style={styles.chatShell}>
        {!currentUser ? (
          <AppCard style={styles.emptyCard}>
            <UsersRound color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>先登录小提督</Text>
            <Text style={styles.emptyText}>登录后才能和搭子互动。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去我的页面登录</AppButton>
          </AppCard>
        ) : null}

        {currentUser && !buddy && isSyncing ? (
          <AppCard style={styles.emptyCard}>
            <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>正在同步搭子互动</Text>
            <Text style={styles.emptyText}>稍等一下，正在拉取聊天记录。</Text>
          </AppCard>
        ) : null}

        {currentUser && !buddy && !isSyncing ? (
          <AppCard style={styles.emptyCard}>
            <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>没有找到这个搭子</Text>
            <Text style={styles.emptyText}>回到监督搭子页，选择一个小队成员再试。</Text>
            <AppButton onPress={() => router.replace(routes.team)}>回到监督搭子</AppButton>
          </AppCard>
        ) : null}

        {currentUser && buddy ? (
          <View style={styles.chatContent}>
            <FlatList
              contentContainerStyle={styles.messageContent}
              data={messages}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(message) => message.id}
              ListEmptyComponent={
                <View style={styles.emptyMessageState}>
                  <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
                  <Text style={styles.emptyTitle}>还没有互动</Text>
                  <Text style={styles.emptyText}>选一个小暗号，轻轻开个头。</Text>
                </View>
              }
              ListHeaderComponent={
                isFetchingNextPage ? <Text style={styles.loadingText}>正在加载更早互动...</Text> : null
              }
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              ref={scrollRef}
              renderItem={renderMessage}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={styles.messageScroll}
            />

            <View style={styles.composer}>
              {isSyncing ? <Text style={styles.loadingText}>搭子互动同步中...</Text> : null}
              <View style={styles.sendHeader}>
                <SendHorizonal color={colors.privacy} size={18} strokeWidth={2.4} />
                <Text style={styles.sendTitle}>发个小暗号</Text>
              </View>
              {disabledSendReason ? <Text style={styles.hintText}>{disabledSendReason}</Text> : null}
              <AppButton
                disabled={!canSend || isMutating}
                onPress={() => setIsActionDrawerVisible(true)}
                style={styles.openDrawerButton}
              >
                选择暗号
              </AppButton>
            </View>
          </View>
        ) : null}
      </View>

      <NudgeActionDrawer
        isMutating={isMutating}
        onClose={() => setIsActionDrawerVisible(false)}
        onSelect={handleSendNudge}
        visible={isActionDrawerVisible}
      />
    </Screen>
  );
}
