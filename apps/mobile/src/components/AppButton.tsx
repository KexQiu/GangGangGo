import { type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

type AppButtonProps = PropsWithChildren<{
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'warning';
}>;

export function AppButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  style,
  variant = 'primary',
}: AppButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, variant);
  const label = accessibilityLabel ?? (typeof children === 'string' ? children : undefined);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}
    >
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors, variant: NonNullable<AppButtonProps['variant']>) {
  const variants = {
    primary: {
      backgroundColor: colors.primary,
      color: '#FFFFFF',
      pressedColor: colors.primaryPressed,
    },
    secondary: {
      backgroundColor: colors.surface,
      color: colors.text,
      pressedColor: colors.surfaceMuted,
    },
    warning: {
      backgroundColor: colors.warningSoft,
      color: colors.text,
      pressedColor: colors.warningSoft,
    },
  };
  const active = variants[variant];

  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: active.backgroundColor,
      borderColor: variant === 'secondary' ? colors.border : 'transparent',
      borderRadius: 18,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 54,
      paddingHorizontal: 18,
    },
    pressed: {
      backgroundColor: active.pressedColor,
      transform: [{ scale: 0.99 }],
    },
    disabled: {
      opacity: 0.55,
    },
    text: {
      color: active.color,
      fontSize: 16,
      fontWeight: '800',
    },
  });
}
