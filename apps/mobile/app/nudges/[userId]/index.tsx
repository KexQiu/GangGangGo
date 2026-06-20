import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, SendHorizonal, UserRound, UsersRound } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { AppTopBar } from '../../../src/components/AppTopBar';
import { PressableScale } from '../../../src/components/feedback/PressableScale';
import { ProfileAvatar } from '../../../src/components/ProfileAvatar';
import { Screen } from '../../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../../src/features/account/authStore';
import {
  ackCopies,
  ackStatuses,
  getDisplayName,
  getNudgeChatMessages,
  nudgeActionTypes,
  nudgeCopies,
  useNudgeStore,
  type NudgeChatMessage,
} from '../../../src/features/nudges/nudgeStore';
import { useTeamStore } from '../../../src/features/team/teamStore';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

const nudgeChatPollIntervalMs = 15_000;

export default function NudgeChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const buddyUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScrollRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const lastContentHeightRef = useRef(0);
  const pendingOlderLoadRef = useRef(false);
  const isPollingRefreshRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const [isActionDrawerVisible, setIsActionDrawerVisible] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const proStatus = useAuthStore((state) => state.proStatus);
  const isLoading = useNudgeStore((state) => state.isLoading);
  const isMutating = useNudgeStore((state) => state.isMutating);
  const loadThread = useNudgeStore((state) => state.loadThread);
  const loadThreads = useNudgeStore((state) => state.loadThreads);
  const threadByBuddyUserId = useNudgeStore((state) => state.threadByBuddyUserId);
  const ackNudge = useNudgeStore((state) => state.ackNudge);
  const sendNudge = useNudgeStore((state) => state.sendNudge);
  const loadCurrentTeam = useTeamStore((state) => state.loadCurrentTeam);
  const team = useTeamStore((state) => state.team);
  const teamIsLoading = useTeamStore((state) => state.isLoading);
  const member = team?.members.find((item) => item.user.id === buddyUserId);
  const threadState = buddyUserId ? threadByBuddyUserId[buddyUserId] : undefined;
  const threadItems = threadState?.items ?? [];
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
  const isThreadBootstrapping = Boolean(accessToken && buddyUserId && !threadState);
  const isSyncing = Boolean(isLoading || teamIsLoading || threadState?.isLoading || isThreadBootstrapping);
  const disabledSendReason = getDisabledSendReason({
    isPro,
    memberStatus: member?.status,
    userId: buddyUserId,
  });

  const refreshChat = useCallback(() => {
    if (!accessToken) {
      return;
    }

    void loadCurrentTeam();
    if (buddyUserId) {
      didInitialScrollRef.current = false;
      shouldStickToBottomRef.current = true;
      void loadThread(buddyUserId, 'initial');
    }
    void loadThreads();
  }, [accessToken, buddyUserId, loadCurrentTeam, loadThread, loadThreads]);

  useFocusEffect(
    useCallback(() => {
      setIsChatFocused(true);
      refreshChat();
      return () => {
        setIsChatFocused(false);
      };
    }, [refreshChat]),
  );

  const refreshChatSilently = useCallback(async () => {
    if (
      !accessToken ||
      !buddyUserId ||
      AppState.currentState !== 'active' ||
      isMutating ||
      isLoading ||
      teamIsLoading ||
      threadState?.isLoading ||
      threadState?.isLoadingMore ||
      isThreadBootstrapping ||
      pendingOlderLoadRef.current ||
      isPollingRefreshRef.current
    ) {
      return;
    }

    isPollingRefreshRef.current = true;

    try {
      await Promise.all([
        loadThread(buddyUserId, 'refresh'),
        loadThreads({ silent: true }),
      ]);
    } finally {
      isPollingRefreshRef.current = false;
    }
  }, [
    accessToken,
    buddyUserId,
    isLoading,
    isMutating,
    isThreadBootstrapping,
    loadThread,
    loadThreads,
    teamIsLoading,
    threadState?.isLoading,
    threadState?.isLoadingMore,
  ]);

  useEffect(() => {
    if (!isChatFocused || !accessToken || !buddyUserId) {
      return undefined;
    }

    const timer = setInterval(() => {
      void refreshChatSilently();
    }, nudgeChatPollIntervalMs);

    return () => clearInterval(timer);
  }, [accessToken, buddyUserId, isChatFocused, refreshChatSilently]);

  useEffect(() => {
    if (!isChatFocused || !accessToken || !buddyUserId) {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState !== 'active' && nextState === 'active') {
        void refreshChatSilently();
      }
    });

    return () => subscription.remove();
  }, [accessToken, buddyUserId, isChatFocused, refreshChatSilently]);

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (pendingOlderLoadRef.current) {
        const offsetDelta = Math.max(height - lastContentHeightRef.current, 0);
        scrollRef.current?.scrollTo({ animated: false, y: offsetDelta });
        pendingOlderLoadRef.current = false;
        lastContentHeightRef.current = height;
        return;
      }

      lastContentHeightRef.current = height;

      if (!didInitialScrollRef.current || shouldStickToBottomRef.current) {
        scrollRef.current?.scrollToEnd({ animated: didInitialScrollRef.current });
        didInitialScrollRef.current = true;
      }
    },
    [],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      shouldStickToBottomRef.current = distanceFromBottom < 80;
      lastContentHeightRef.current = contentSize.height;

      if (!buddyUserId || !threadState?.hasMore || threadState.isLoadingMore || pendingOlderLoadRef.current) {
        return;
      }

      if (contentOffset.y < 32) {
        pendingOlderLoadRef.current = true;
        void loadThread(buddyUserId, 'older');
      }
    },
    [buddyUserId, loadThread, threadState?.hasMore, threadState?.isLoadingMore],
  );

  const handleSendNudge = useCallback(
    (type: (typeof nudgeActionTypes)[number]) => {
      if (!buddyUserId) {
        return;
      }

      shouldStickToBottomRef.current = true;
      setIsActionDrawerVisible(false);
      void sendNudge(buddyUserId, type);
    },
    [buddyUserId, sendNudge],
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
            <ScrollView
              contentContainerStyle={styles.messageContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              ref={scrollRef}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={styles.messageScroll}
            >
              {threadState?.isLoadingMore ? <Text style={styles.loadingText}>正在加载更早互动...</Text> : null}
              {messages.length === 0 ? (
                <View style={styles.emptyMessageState}>
                  <MessageCircle color={colors.privacy} size={28} strokeWidth={2.4} />
                  <Text style={styles.emptyTitle}>还没有互动</Text>
                  <Text style={styles.emptyText}>选一个小暗号，轻轻开个头。</Text>
                </View>
              ) : (
                messages.map((message) => (
                  <MessageBubble
                    buddyUserId={buddyUserId}
                    isMutating={isMutating}
                    key={message.id}
                    message={message}
                    onAck={(status) => void ackNudge(message.nudge.id, status, buddyUserId)}
                  />
                ))
              )}
            </ScrollView>

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

type NudgeActionDrawerProps = {
  isMutating: boolean;
  onClose: () => void;
  onSelect: (type: (typeof nudgeActionTypes)[number]) => void;
  visible: boolean;
};

function NudgeActionDrawer({ isMutating, onClose, onSelect, visible }: NudgeActionDrawerProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const sheetTranslateY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    if (!visible) {
      sheetTranslateY.setValue(28);
      return;
    }

    Animated.timing(sheetTranslateY, {
      duration: 180,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [sheetTranslateY, visible]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.drawerRoot}>
        <Pressable accessibilityLabel="关闭暗号选择" onPress={onClose} style={styles.drawerBackdrop} />
        <Animated.View style={[styles.drawerSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.drawerHandle} />
          <Text style={styles.drawerTitle}>选择暗号</Text>
          <View style={styles.drawerActions}>
            {nudgeActionTypes.map((type) => (
              <AppButton
                disabled={isMutating}
                key={type}
                onPress={() => onSelect(type)}
                style={styles.drawerActionButton}
                variant="secondary"
              >
                {nudgeCopies[type]}
              </AppButton>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

type MessageBubbleProps = {
  isMutating: boolean;
  message: NudgeChatMessage;
  onAck: (status: (typeof ackStatuses)[number]) => void;
  buddyUserId?: string;
};

function MessageBubble({ buddyUserId, isMutating, message, onAck }: MessageBubbleProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isOutgoing = message.direction === 'outgoing';
  const shouldShowAckActions = message.direction === 'incoming' && !message.nudge.ack;
  const ackTag = message.nudge.ack
    ? `${isOutgoing ? '对方' : '我'}${ackCopies[message.nudge.ack.status]}`
    : null;

  return (
    <View style={[styles.messageRow, isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
      <ProfileAvatar avatarUrl={message.sender.avatarUrl} nickname={getDisplayName(message.sender)} size="sm" />
      <View style={[styles.bubbleGroup, isOutgoing ? styles.bubbleGroupOutgoing : styles.bubbleGroupIncoming]}>
        <View style={[styles.bubble, isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
          <Text style={[styles.bubbleText, isOutgoing ? styles.bubbleTextOutgoing : styles.bubbleTextIncoming]}>
            {message.text}
          </Text>
          <View style={styles.bubbleMetaRow}>
            <Text style={[styles.bubbleTime, isOutgoing ? styles.bubbleTimeOutgoing : styles.bubbleTimeIncoming]}>
              {formatMessageTime(message.createdAt)}
            </Text>
            {ackTag ? (
              <View style={[styles.ackTag, isOutgoing ? styles.ackTagOutgoing : styles.ackTagIncoming]}>
                <Text style={[styles.ackTagText, isOutgoing ? styles.ackTagTextOutgoing : styles.ackTagTextIncoming]}>
                  {ackTag}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {shouldShowAckActions && buddyUserId ? (
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

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ackActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    ackButton: {
      minHeight: 36,
      paddingHorizontal: 10,
    },
    ackTag: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    ackTagIncoming: {
      backgroundColor: colors.primarySoft,
    },
    ackTagOutgoing: {
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    ackTagText: {
      fontSize: 11,
      fontWeight: '900',
      lineHeight: 14,
    },
    ackTagTextIncoming: {
      color: colors.primaryPressed,
    },
    ackTagTextOutgoing: {
      color: '#FFFFFF',
    },
    bubble: {
      borderRadius: 8,
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleGroup: {
      gap: 4,
      maxWidth: '78%',
    },
    bubbleGroupIncoming: {
      alignItems: 'flex-start',
    },
    bubbleGroupOutgoing: {
      alignItems: 'flex-end',
    },
    bubbleIncoming: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    bubbleOutgoing: {
      backgroundColor: colors.primary,
    },
    bubbleTextIncoming: {
      color: colors.text,
    },
    bubbleText: {
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 21,
    },
    bubbleTextOutgoing: {
      color: '#FFFFFF',
    },
    bubbleMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    bubbleTime: {
      fontSize: 11,
      fontWeight: '700',
    },
    bubbleTimeIncoming: {
      color: colors.textSubtle,
    },
    bubbleTimeOutgoing: {
      color: 'rgba(255,255,255,0.78)',
    },
    chatContent: {
      flex: 1,
    },
    chatShell: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    composer: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderTopWidth: 1,
      gap: 10,
      paddingBottom: 6,
      paddingTop: 12,
    },
    drawerActionButton: {
      minHeight: 46,
    },
    drawerActions: {
      gap: 10,
    },
    drawerBackdrop: {
      flex: 1,
    },
    drawerHandle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 4,
      width: 36,
    },
    drawerRoot: {
      backgroundColor: 'rgba(0,0,0,0.32)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    drawerSheet: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      gap: 14,
      paddingBottom: 28,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    drawerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyMessageState: {
      alignItems: 'center',
      flexGrow: 1,
      gap: 12,
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 28,
    },
    emptyCard: {
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 21,
      textAlign: 'center',
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      textAlign: 'center',
    },
    messageContent: {
      flexGrow: 1,
      gap: 12,
      justifyContent: 'flex-end',
      paddingBottom: 18,
      paddingTop: 12,
    },
    messageRow: {
      alignItems: 'flex-start',
      gap: 8,
    },
    messageRowIncoming: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    messageRowOutgoing: {
      flexDirection: 'row-reverse',
      justifyContent: 'flex-start',
    },
    messageScroll: {
      flex: 1,
    },
    openDrawerButton: {
      minHeight: 48,
    },
    screen: {
      flex: 1,
    },
    sendHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    sendTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    topBarIconButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
  });
}

function getDisabledSendReason(input: {
  isPro: boolean;
  memberStatus: null | string | undefined;
  userId: null | string | undefined;
}) {
  if (!input.userId) {
    return '没有找到这个搭子。';
  }

  if (!input.isPro) {
    return '主动提醒搭子需要小提督 Pro。';
  }

  if (!input.memberStatus) {
    return '这个搭子不在当前小队中，不能继续提醒。';
  }

  if (input.memberStatus === 'paused') {
    return '对方暂停共享中，暂时不能轻轻戳。';
  }

  if (input.memberStatus !== 'active') {
    return '这个搭子暂时不能接收提醒。';
  }

  return null;
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(new Date(value));
}
