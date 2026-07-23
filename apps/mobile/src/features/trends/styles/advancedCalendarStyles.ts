import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';

const calendarColumnGap = 5;
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createAdvancedCalendarStyles(colors: ThemeColors) {
  return StyleSheet.create({
    calendarDayCell: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexShrink: 0,
      gap: 4,
      justifyContent: 'center',
      overflow: 'hidden',
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    calendarDayCellActive: {
      backgroundColor: colors.surface,
    },
    calendarDayCellPressed: {
      transform: [{ scale: 0.97 }],
    },
    calendarDayCellQuiet: {
      backgroundColor: colors.surfaceMuted,
    },
    calendarDayNumber: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 15,
      textAlign: 'center',
    },
    calendarDayNumberMuted: {
      color: colors.textSubtle,
      fontWeight: '700',
    },
    calendarDayPlaceholder: {
      flexShrink: 0,
    },
    calendarGrid: {
      gap: 14,
    },
    calendarMonth: {
      gap: 8,
    },
    calendarMonthGrid: {
      gap: calendarColumnGap,
    },
    calendarMonthPage: {
      flexShrink: 0,
    },
    calendarMonthTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    calendarPager: {
      overflow: 'hidden',
    },
    calendarTodayCell: {
      borderColor: colors.primaryPressed,
      borderWidth: 2,
    },
    calendarTodayNumber: {
      color: colors.primaryPressed,
      fontWeight: '900',
    },
    calendarWeekRow: {
      flexDirection: 'row',
      gap: calendarColumnGap,
    },
    dayDetailContent: {
      gap: 16,
      paddingBottom: 20,
    },
    dayDetailRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    dayDetailRowDot: {
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    dayDetailRowLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 18,
    },
    dayDetailRows: {
      gap: 8,
    },
    dayDetailRowValue: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    dayDot: {
      borderRadius: 3,
      height: 5,
      width: 5,
    },
    dayDotRow: {
      flexDirection: 'row',
      gap: 3,
    },
    monthIndicatorDot: {
      backgroundColor: colors.border,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    monthIndicatorDotActive: {
      backgroundColor: colors.primary,
      width: 18,
    },
    monthIndicatorRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
    },
    toiletDetailCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      marginTop: -5,
    },
    toiletDetailEmpty: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    toiletDetailSection: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 8,
      paddingTop: 16,
    },
    toiletDetailTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 21,
    },
    toiletSessionDuration: {
      color: colors.primaryPressed,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      marginLeft: 10,
    },
    toiletSessionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    toiletSessionRow: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 7,
      padding: 12,
    },
    toiletSessionRowPressed: {
      opacity: 0.78,
      transform: [{ scale: 0.99 }],
    },
    toiletSessionSummary: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    toiletSessionTime: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
    },
    toiletSignalChip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    toiletSignalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    toiletSignalText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 14,
    },
    weekdayRow: {
      flexDirection: 'row',
      gap: calendarColumnGap,
    },
    weekdayText: {
      color: colors.textSubtle,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 14,
      textAlign: 'center',
    },
  });
}
