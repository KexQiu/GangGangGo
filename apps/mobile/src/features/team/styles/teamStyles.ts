import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    avatarOverflow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.surface,
      borderRadius: 20,
      borderWidth: 2,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    avatarOverflowText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },
    avatarStack: {
      flexDirection: 'row',
    },
    avatarStackItem: {
      borderColor: colors.surface,
      borderRadius: 22,
      borderWidth: 2,
    },
    avatarStackOverlap: {
      marginLeft: -10,
    },
    buddyList: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 0,
      paddingHorizontal: 12,
    },
    buddyCopy: {
      flex: 1,
      gap: 4,
    },
    buddyRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 88,
      paddingVertical: 14,
    },
    buddyRowLast: {
      borderBottomWidth: 0,
    },
    buddyName: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '900',
    },
    buddyPrimary: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
    },
    buddyPrimaryPending: {
      color: colors.danger,
    },
    buddySecondary: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    buddyTime: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '700',
    },
    buddyTitleLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    buddyTrailing: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
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
      lineHeight: 19,
      textAlign: 'center',
    },
    iconActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      textAlign: 'center',
    },
    pendingBadge: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    pendingBadgeText: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '900',
    },
    pendingStatLabel: {
      color: colors.warning,
    },
    pendingStatPill: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    pendingStatValue: {
      color: colors.warning,
    },
    socialCopy: {
      gap: 0,
    },
    socialHeader: {
      gap: 14,
    },
    socialTopLine: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    statPill: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      gap: 3,
      minHeight: 54,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    statRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    teamName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 28,
    },
    weeklyCopy: {
      flex: 1,
      gap: 3,
    },
    weeklyStrip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 14,
    },
    weeklyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    weeklyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}
