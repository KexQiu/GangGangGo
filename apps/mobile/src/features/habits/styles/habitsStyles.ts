import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    summaryCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
    },
    summaryIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginRight: 14,
      width: 56,
    },
    summaryCopy: {
      flex: 1,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 6,
    },
    summaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
    },
    statCard: {
      alignItems: 'center',
      flex: 1,
      padding: 14,
    },
    statValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 5,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },
    list: {
      gap: 14,
    },
    habitCard: {
      padding: 18,
    },
    habitHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    iconBadge: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    habitHeaderCopy: {
      flex: 1,
    },
    habitTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 4,
    },
    habitTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    headerStateIcon: {
      alignItems: 'center',
      borderRadius: 14,
      height: 28,
      justifyContent: 'center',
      marginLeft: 8,
      width: 28,
    },
    habitSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      minHeight: 62,
      paddingHorizontal: 14,
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      marginRight: 11,
      width: 32,
    },
    emptyCopy: {
      flex: 1,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 3,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    selectedStandardNote: {
      borderRadius: 14,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    selectedStandardLabel: {
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 4,
    },
    selectedStandardText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    footnote: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 18,
      marginBottom: 4,
      marginTop: 16,
      textAlign: 'center',
    },
    sliderTrack: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 54,
      overflow: 'hidden',
      padding: 4,
    },
    sliderThumb: {
      borderRadius: 15,
      borderWidth: 1,
      bottom: 4,
      left: 4,
      position: 'absolute',
      top: 4,
    },
    sliderStep: {
      alignItems: 'center',
      flex: 1,
      gap: 3,
      justifyContent: 'center',
      zIndex: 1,
    },
    sliderStepText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
}
