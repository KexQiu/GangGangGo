import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
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
