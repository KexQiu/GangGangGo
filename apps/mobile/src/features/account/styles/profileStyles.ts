import { StyleSheet } from 'react-native';

import type { useAppTheme } from '../../../theme/themeProvider';
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    avatarButton: {
      flex: 1,
    },
    avatarGrid: {
      gap: 7,
    },
    avatarHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
    },
    avatarOption: {
      alignItems: 'center',
      aspectRatio: 1,
      flex: 1,
      justifyContent: 'center',
      position: 'relative',
    },
    avatarPicker: {
      gap: 14,
    },
    avatarPlaceholder: {
      aspectRatio: 1,
      flex: 1,
    },
    avatarRow: {
      flexDirection: 'row',
      gap: 7,
    },
    avatarSection: {
      gap: 10,
    },
    backgroundGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    backgroundOption: {
      flex: 1,
      position: 'relative',
    },
    backgroundSwatch: {
      aspectRatio: 1,
      borderRadius: 16,
      position: 'relative',
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
      gap: 14,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 26,
      textAlign: 'center',
    },
    fieldGroup: {
      gap: 8,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 20,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      minHeight: 54,
      paddingHorizontal: 16,
    },
    profileCard: {
      gap: 18,
    },
    selectedDot: {
      backgroundColor: colors.primary,
      borderColor: colors.surface,
      borderRadius: 5,
      borderWidth: 2,
      height: 10,
      position: 'absolute',
      right: 5,
      top: 5,
      width: 10,
    },
  });
}
