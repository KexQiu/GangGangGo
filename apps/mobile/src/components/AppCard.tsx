import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

type AppCardProps = PropsWithChildren<{
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function AppCard({ children, muted = false, style }: AppCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(muted ? colors.surfaceMuted : colors.surface, colors.border);

  return <View style={[styles.card, style]}>{children}</View>;
}

function createStyles(backgroundColor: string, borderColor: string) {
  return StyleSheet.create({
    card: {
      backgroundColor,
      borderColor,
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
    },
  });
}
