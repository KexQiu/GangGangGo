import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createFriendStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderRadius: 12,
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    badgeText: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '900',
    },
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
      textAlign: 'center',
    },
    friendCopy: {
      flex: 1,
      gap: 4,
    },
    friendList: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
    },
    friendName: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '900',
    },
    friendPreview: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
    },
    friendRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 88,
      paddingVertical: 14,
    },
    friendRowLast: {
      borderBottomWidth: 0,
    },
    friendStatus: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    headerCard: {
      gap: 12,
    },
    headerLine: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerText: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    headerTitleLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    statText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    trailing: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
  });
}
