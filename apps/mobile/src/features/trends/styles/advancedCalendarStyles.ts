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
    dayDetailBackdrop: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    dayDetailCaption: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 3,
    },
    dayDetailCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 16,
      maxWidth: 360,
      padding: 18,
      width: '100%',
    },
    dayDetailCloseButton: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    dayDetailCloseText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 17,
    },
    dayDetailHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    dayDetailOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
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
    dayDetailTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 27,
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
