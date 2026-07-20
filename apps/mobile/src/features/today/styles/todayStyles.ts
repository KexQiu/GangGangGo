import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    reminderPrompt: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    reminderPromptIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      marginRight: 11,
      width: 36,
    },
    reminderPromptTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 3,
    },
    reminderPromptText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    reminderPromptCta: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      marginLeft: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    reminderPromptCtaText: {
      color: colors.privacy,
      fontSize: 12,
      fontWeight: '800',
    },
    heroCard: {
      borderRadius: 24,
      marginBottom: 12,
      padding: 18,
    },
    heroTop: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 14,
    },
    heroCopy: {
      flex: 1,
      marginRight: 14,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
    },
    mutedText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
    },
    ringOuter: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },
    ringInner: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 27,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    actionRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 12,
      padding: 14,
    },
    rowIcon: {
      alignItems: 'center',
      borderRadius: 19,
      height: 38,
      justifyContent: 'center',
      marginRight: 12,
      width: 38,
    },
    infoBadge: {
      backgroundColor: colors.infoSoft,
    },
    rowCopy: {
      flex: 1,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 3,
    },
  });
}
