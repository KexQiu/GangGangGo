import { type ComponentType } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/themeProvider';
import { AppButton } from './AppButton';
import { AppCard } from './AppCard';
import { PageHeader } from './PageHeader';
import { Screen } from './Screen';

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type FeaturePlaceholderProps = {
  icon: ComponentType<IconProps>;
  nextStep: string;
  primaryActionLabel?: string;
  subtitle: string;
  title: string;
};

export function FeaturePlaceholder({
  icon: Icon,
  nextStep,
  primaryActionLabel = '返回首页',
  subtitle,
  title,
}: FeaturePlaceholderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Screen>
      <PageHeader subtitle={subtitle} title={title} />

      <AppCard muted style={styles.card}>
        <View style={styles.iconBadge}>
          <Icon color={colors.primaryPressed} size={34} strokeWidth={2.3} />
        </View>
        <Text style={styles.cardTitle}>页面壳已就绪</Text>
        <Text style={styles.cardText}>{nextStep}</Text>
      </AppCard>

      <AppButton onPress={() => router.push('/')}>{primaryActionLabel}</AppButton>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      marginBottom: 18,
      paddingVertical: 32,
    },
    iconBadge: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 32,
      height: 64,
      justifyContent: 'center',
      marginBottom: 22,
      width: 64,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 10,
    },
    cardText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 22,
      textAlign: 'center',
    },
  });
}
