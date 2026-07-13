import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createReminderSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pressed: {
      opacity: 0.82,
    },
    rangeEditor: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      padding: 13,
    },
    rangeEditorHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    rangeSubTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    rangeTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 3,
    },
    rangeTitleIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      marginRight: 10,
      width: 30,
    },
    rangeTitleRow: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
    },
    removeRangeButton: {
      alignItems: 'center',
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    segment: {
      alignItems: 'center',
      borderRadius: 14,
      flex: 1,
      justifyContent: 'center',
      minHeight: 42,
    },
    segmentSelected: {
      backgroundColor: colors.surface,
    },
    segmentText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    segmentTextSelected: {
      color: colors.primaryPressed,
    },
    settingCopy: {
      flex: 1,
      marginRight: 12,
    },
    settingDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    settingHeader: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    settingIcon: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      marginRight: 12,
      width: 34,
    },
    settingTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 5,
    },
    timeButton: {
      alignItems: 'center',
      borderRadius: 13,
      height: 26,
      justifyContent: 'center',
      width: 28,
    },
    timeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    timeRowLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    timeRows: {
      gap: 8,
    },
    timeStepper: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 34,
      paddingHorizontal: 4,
    },
    timeValue: {
      color: colors.text,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      minWidth: 48,
      textAlign: 'center',
    },
  });
}
