import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ subtitle, title }: PageHeaderProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.header}>
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
