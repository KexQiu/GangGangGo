import { type PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

type PageStackProps = PropsWithChildren<{
  gap?: 'compact' | 'regular' | 'loose';
  style?: StyleProp<ViewStyle>;
}>;

const stackGaps = {
  compact: 12,
  regular: 16,
  loose: 20,
};

export function PageStack({ children, gap = 'regular', style }: PageStackProps) {
  return <View style={[styles.stack, { gap: stackGaps[gap] }, style]}>{children}</View>;
}

type PageSectionProps = PropsWithChildren<{
  subtitle?: string;
  title: string;
  style?: StyleProp<ViewStyle>;
}>;

export function PageSection({ children, style, subtitle, title }: PageSectionProps) {
  const { colors } = useAppTheme();
  const sectionStyles = createSectionStyles(colors);

  return (
    <View style={[sectionStyles.section, style]}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.title}>{title}</Text>
        {subtitle ? <Text style={sectionStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      gap: 4,
      paddingHorizontal: 2,
    },
    section: {
      gap: 10,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 22,
    },
  });
}

const styles = StyleSheet.create({
  stack: {
    width: '100%',
  },
});
