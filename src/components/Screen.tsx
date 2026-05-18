import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme/themeProvider';

type ScreenProps = PropsWithChildren<{
  bottomSafeArea?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({ bottomSafeArea = false, children, contentStyle, scroll = true }: ScreenProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors.background);
  const edges: Edge[] = bottomSafeArea ? ['top', 'right', 'bottom', 'left'] : ['top', 'right', 'left'];

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.safeArea, contentStyle]}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(backgroundColor: string) {
  return StyleSheet.create({
    safeArea: {
      backgroundColor,
      flex: 1,
    },
    content: {
      paddingBottom: 32,
      paddingHorizontal: 24,
      paddingTop: 18,
    },
  });
}
