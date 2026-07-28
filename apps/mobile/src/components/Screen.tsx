import { Children, isValidElement, type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTopBar } from './AppTopBar';
import { useAppTheme } from '../theme/themeProvider';

type ScreenProps = PropsWithChildren<{
  bottomSafeArea?: boolean;
  scroll?: boolean;
  scrollEnabled?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({
  bottomSafeArea = false,
  children,
  contentStyle,
  scroll = true,
  scrollEnabled = true,
}: ScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors.background);
  const safeAreaStyle = {
    paddingBottom: bottomSafeArea ? insets.bottom : 0,
    paddingLeft: insets.left,
    paddingRight: insets.right,
    paddingTop: insets.top,
  };
  const { fixedTopBar, scrollChildren } = extractFixedTopBar(children);

  if (!scroll) {
    return (
      <View style={[styles.safeArea, safeAreaStyle]}>
        <View style={[styles.nonScrollContent, contentStyle]}>
          {fixedTopBar ? <View style={styles.fixedTopBar}>{fixedTopBar}</View> : null}
          {scrollChildren}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, safeAreaStyle]}>
      {fixedTopBar ? <View style={styles.fixedTopBar}>{fixedTopBar}</View> : null}
      <ScrollView
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={[styles.content, contentStyle]}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        {scrollChildren}
      </ScrollView>
    </View>
  );
}

function extractFixedTopBar(children: ReactNode): {
  fixedTopBar: ReactNode | null;
  scrollChildren: ReactNode;
} {
  const childArray = Children.toArray(children);
  const topBarIndex = childArray.findIndex((child) => isValidElement(child) && isAppTopBarElement(child));

  if (topBarIndex !== 0) {
    return {
      fixedTopBar: null,
      scrollChildren: children,
    };
  }

  return {
    fixedTopBar: childArray[0],
    scrollChildren: childArray.slice(1),
  };
}

function isAppTopBarElement(child: React.ReactElement): boolean {
  if (child.type === AppTopBar) {
    return true;
  }

  if (typeof child.type === 'function') {
    const componentType = child.type as { displayName?: string };
    return componentType.displayName === AppTopBar.displayName;
  }

  return false;
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
      paddingTop: 0,
    },
    fixedTopBar: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    nonScrollContent: {
      flex: 1,
    },
  });
}
