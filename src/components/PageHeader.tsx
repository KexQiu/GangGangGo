import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function PageHeader({ eyebrow, subtitle, title }: PageHeaderProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      marginBottom: 24,
    },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 0,
      marginBottom: 8,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 22,
    },
  });
}
