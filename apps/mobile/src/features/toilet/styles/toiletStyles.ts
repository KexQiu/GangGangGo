import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
import type { ToiletTimerStage } from '../toiletTypes';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors, stage: ToiletTimerStage) {
  const accentColor =
    stage === 'normal'
      ? colors.primary
      : stage === 'gentle_warning'
        ? colors.info
        : stage === 'severe_warning'
          ? colors.danger
          : colors.warning;
  const accentSoft =
    stage === 'normal'
      ? colors.primarySoft
      : stage === 'gentle_warning'
        ? colors.infoSoft
        : stage === 'severe_warning'
          ? colors.dangerSoft
          : colors.warningSoft;

  return StyleSheet.create({
    startCard: {
      alignItems: 'center',
      marginBottom: 18,
      paddingVertical: 34,
    },
    startIcon: {
      alignItems: 'center',
      backgroundColor: colors.infoSoft,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: 20,
      width: 72,
    },
    startTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 10,
    },
    startText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 22,
      textAlign: 'center',
    },
    screenContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingBottom: 24,
      paddingHorizontal: 24,
      paddingTop: 18,
    },
    timerCard: {
      alignItems: 'center',
      borderRadius: 32,
      paddingVertical: 38,
    },
    timerRing: {
      alignItems: 'center',
      backgroundColor: accentSoft,
      borderColor: accentColor,
      borderRadius: 96,
      borderWidth: 8,
      height: 192,
      justifyContent: 'center',
      marginBottom: 26,
      width: 192,
    },
    timerText: {
      color: colors.text,
      fontSize: 54,
      fontWeight: '800',
      letterSpacing: 0,
    },
    stageTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    stageDescription: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    warningCard: {
      backgroundColor: accentSoft,
      borderColor: accentColor,
      padding: 18,
    },
    warningTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 8,
    },
    warningText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
    pauseIndicator: {
      alignItems: 'center',
      height: 18,
      justifyContent: 'center',
      opacity: 0,
    },
  });
}
