import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    actionCard: {
      gap: 14,
    },
    actionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    actionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 4,
    },
    copy: {
      flex: 1,
    },
    debugCard: {
      gap: 12,
    },
    debugLabel: {
      color: colors.textMuted,
      flexShrink: 0,
      fontSize: 12,
      fontWeight: '800',
      width: 88,
    },
    debugRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    debugRows: {
      gap: 8,
    },
    debugTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 21,
    },
    debugValue: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'right',
    },
    divider: {
      backgroundColor: colors.border,
      height: 1,
    },
    heroBody: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    heroCard: {
      alignItems: 'center',
      gap: 10,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 21,
      fontWeight: '900',
      textAlign: 'center',
    },
    message: {
      color: colors.info,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 19,
    },
    noticeBody: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
    },
    noticeCard: {
      gap: 12,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    jsonText: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
      padding: 12,
    },
    logDetail: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    logHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    logItem: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 4,
      paddingTop: 10,
    },
    logTime: {
      color: colors.textSubtle,
      fontSize: 11,
      fontWeight: '700',
    },
    logTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '900',
    },
    statusCard: {
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    statusLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    statusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 46,
    },
    statusValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
  });
}
