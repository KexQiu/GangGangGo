import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    calendarCard: {
      padding: 16,
    },
    emptyCard: {
      gap: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    headerBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    headerBadge: {
      alignItems: 'center',
      flexDirection: 'row',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    headerBadgeText: {
      color: colors.primaryPressed,
      fontSize: 12,
      fontWeight: '900',
      lineHeight: 15,
    },
    headerCard: {
      gap: 9,
    },
    headerStatus: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    headerStatusText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
    },
    headerStatusTextActive: {
      color: colors.primary,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 27,
    },
    headerTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    insightCard: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    insightCopy: {
      flex: 1,
    },
    insightTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 5,
    },
    legendDot: {
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    noticeBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    noticeCard: {
      alignItems: 'center',
      gap: 12,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
    },
    summaryTile: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      flexBasis: '47%',
      flexGrow: 1,
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    summaryTileHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
    },
  });
}
