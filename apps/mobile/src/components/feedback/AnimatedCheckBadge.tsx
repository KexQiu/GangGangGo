import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useAppTheme } from '../../theme/themeProvider';

type AnimatedCheckBadgeProps = {
  active: boolean;
  size?: number;
};

export function AnimatedCheckBadge({ active, size = 18 }: AnimatedCheckBadgeProps) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      friction: 6,
      tension: 180,
      toValue: active ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Check color={colors.primaryPressed} size={size} strokeWidth={2.8} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
