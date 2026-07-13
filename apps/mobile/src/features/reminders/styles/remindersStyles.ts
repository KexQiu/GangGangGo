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
      backgroundColor: colors.surface,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginRight: 14,
      width: 56,
    },
    summaryCopy: {
      flex: 1,
    },
    summaryTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 7,
    },
    summaryText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    permissionCard: {
      borderColor: colors.info,
      marginBottom: 18,
    },
    permissionHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      marginBottom: 16,
    },
    permissionCopy: {
      flex: 1,
      marginLeft: 10,
    },
    permissionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    permissionText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    permissionButton: {
      minHeight: 48,
    },
    errorCard: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      marginBottom: 18,
    },
    errorText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 20,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
      marginTop: 2,
    },
    settingsCard: {
      marginBottom: 22,
      padding: 18,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 10,
      marginTop: 18,
    },
    segmentRow: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      padding: 4,
    },
    fieldNote: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 10,
    },
    divider: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 18,
    },
    quietHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 14,
    },
    quietIcon: {
      alignItems: 'center',
      backgroundColor: colors.infoSoft,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    quietCopy: {
      flex: 1,
    },
    quietTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    quietText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
    quietList: {
      gap: 10,
      marginBottom: 4,
    },
    quietOption: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    quietOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    quietOptionText: {
      flex: 1,
      marginRight: 10,
    },
    quietOptionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    quietOptionDescription: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    manualQuietHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 22,
    },
    manualQuietCopy: {
      flex: 1,
    },
    manualQuietTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 5,
    },
    manualQuietText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    manualQuietCount: {
      color: colors.primaryPressed,
      fontSize: 12,
      fontWeight: '900',
      marginLeft: 12,
      marginTop: 2,
    },
    quietEmpty: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: 14,
      padding: 14,
    },
    quietEmptyText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
      marginLeft: 10,
    },
    rangeList: {
      gap: 10,
      marginTop: 14,
    },
    addRangeRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    addRangeButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 42,
    },
    addRangeText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '900',
      marginLeft: 6,
    },
    disabledButton: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.82,
    },
  });
}
