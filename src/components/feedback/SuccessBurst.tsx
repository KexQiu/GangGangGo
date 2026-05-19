import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../theme/themeProvider';

type SuccessBurstProps = {
  playKey: number;
  size?: number;
};

const burstItems = [
  { angle: -90, distance: 34 },
  { angle: -35, distance: 39 },
  { angle: 15, distance: 32 },
  { angle: 70, distance: 38 },
  { angle: 130, distance: 34 },
  { angle: 205, distance: 36 },
];

export function SuccessBurst({ playKey, size = 120 }: SuccessBurstProps) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const items = useMemo(
    () =>
      burstItems.map((item) => {
        const radians = (item.angle * Math.PI) / 180;
        return {
          ...item,
          x: Math.cos(radians) * item.distance,
          y: Math.sin(radians) * item.distance,
        };
      }),
    [],
  );

  useEffect(() => {
    if (playKey <= 0) {
      return;
    }

    progress.setValue(0);
    Animated.timing(progress, {
      duration: 620,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [playKey, progress]);

  return (
    <View pointerEvents="none" style={[styles.container, { height: size, width: size }]}>
      {items.map((item, index) => (
        <Animated.View
          key={`${item.angle}-${index}`}
          style={[
            styles.dot,
            {
              backgroundColor: index % 2 === 0 ? colors.primary : colors.warning,
              opacity: progress.interpolate({
                inputRange: [0, 0.18, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, item.x],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, item.y],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0.3, 1, 0.6],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  dot: {
    borderRadius: 999,
    height: 8,
    position: 'absolute',
    width: 8,
  },
});
