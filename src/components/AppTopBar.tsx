import { type ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

type AppTopBarProps = {
  fallbackHref: Href;
  onBackPress?: () => void;
  right?: ReactNode;
  title: string;
  variant?: 'back' | 'close';
};

export function AppTopBar({ fallbackHref, onBackPress, right, title, variant = 'back' }: AppTopBarProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const Icon = variant === 'close' ? X : ChevronLeft;

  function handleBackPress() {
    if (onBackPress) {
      onBackPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  }

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={variant === 'close' ? '关闭' : '返回'}
        onPress={handleBackPress}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Icon color={colors.text} size={22} strokeWidth={2.5} />
      </Pressable>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 18,
      minHeight: 44,
    },
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    pressed: {
      opacity: 0.78,
      transform: [{ scale: 0.98 }],
    },
    title: {
      color: colors.text,
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      marginHorizontal: 12,
      textAlign: 'center',
    },
    rightSlot: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 44,
    },
  });
}
