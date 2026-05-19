import { type PropsWithChildren, useRef } from 'react';
import {
  Animated,
  Pressable,
  type AccessibilityRole,
  type AccessibilityState,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PropsWithChildren<{
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function PressableScale({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
  disabled = false,
  onPress,
  scaleTo = 0.98,
  style,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
    Animated.spring(scale, {
      friction: 7,
      tension: 180,
      toValue,
      useNativeDriver: true,
    }).start();
  }

  return (
    <AnimatedPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
