import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { ProfileAvatar } from '../../../components/ProfileAvatar';
import {
  ackCopies,
  ackStatuses,
  getDisplayName,
  nudgeActionTypes,
  nudgeCopies,
  type NudgeChatMessage,
} from '../nudgeModel';
import { formatMessageTime } from '../nudgePresentation';
import { useAppTheme } from '../../../theme/themeProvider';
import { createStyles } from '../styles/nudgeThreadStyles';

type NudgeActionDrawerProps = {
  isMutating: boolean;
  onClose: () => void;
  onSelect: (type: (typeof nudgeActionTypes)[number]) => void;
  visible: boolean;
};

export function NudgeActionDrawer({ isMutating, onClose, onSelect, visible }: NudgeActionDrawerProps) {
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

export function MessageBubble({ buddyUserId, isMutating, message, onAck }: MessageBubbleProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isOutgoing = message.direction === 'outgoing';
  const shouldShowAckActions = message.direction === 'incoming' && !message.nudge.ack;
  const ackTag = message.nudge.ack ? `${isOutgoing ? '对方' : '我'}${ackCopies[message.nudge.ack.status]}` : null;

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
