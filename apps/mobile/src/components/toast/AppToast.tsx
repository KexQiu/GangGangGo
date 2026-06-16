import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useAppTheme } from '../../theme/themeProvider';

export type AppToastType = 'error' | 'info' | 'success';

type AppToast = {
  durationMs: number;
  id: number;
  message: string;
  type: AppToastType;
};

type ShowToastOptions = {
  durationMs?: number;
  type?: AppToastType;
};

type ToastState = {
  hideToast: () => void;
  showToast: (message: string, options?: ShowToastOptions) => void;
  toast: AppToast | null;
};

const defaultToastDurationMs = 3000;
let nextToastId = 1;

const useToastStore = create<ToastState>((set) => ({
  hideToast: () => set({ toast: null }),
  showToast: (message, options = {}) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    set({
      toast: {
        durationMs: options.durationMs ?? defaultToastDurationMs,
        id: nextToastId,
        message: trimmedMessage,
        type: options.type ?? 'info',
      },
    });
    nextToastId += 1;
  },
  toast: null,
}));

export function showToast(message: string, options?: ShowToastOptions) {
  useToastStore.getState().showToast(message, options);
}

export function AppToastHost() {
  const { colors } = useAppTheme();
  const hideToast = useToastStore((state) => state.hideToast);
  const toast = useToastStore((state) => state.toast);
  const styles = createStyles(colors, toast?.type ?? 'info');

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      const currentToast = useToastStore.getState().toast;

      if (currentToast?.id === toast.id) {
        hideToast();
      }
    }, toast.durationMs);

    return () => clearTimeout(timeout);
  }, [hideToast, toast]);

  if (!toast) {
    return null;
  }

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.overlay}>
      <View accessibilityRole="alert" pointerEvents="none" style={styles.toast}>
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors, type: AppToastType) {
  const tone = {
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      textColor: colors.danger,
    },
    info: {
      backgroundColor: colors.infoSoft,
      borderColor: colors.info,
      textColor: colors.info,
    },
    success: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryPressed,
      textColor: colors.primaryPressed,
    },
  }[type];

  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      paddingHorizontal: 20,
      zIndex: 1000,
    },
    text: {
      color: tone.textColor,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
      textAlign: 'center',
    },
    toast: {
      backgroundColor: tone.backgroundColor,
      borderColor: tone.borderColor,
      borderRadius: 18,
      borderWidth: 1,
      elevation: 8,
      marginTop: 8,
      maxWidth: 520,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: '#000000',
      shadowOffset: {
        height: 8,
        width: 0,
      },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      width: '100%',
    },
  });
}
