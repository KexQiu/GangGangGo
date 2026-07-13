import { useRouter } from 'expo-router';
import { Crown, FileChartColumnIncreasing, UsersRound, Watch } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { PageStack } from '../../src/components/PageStack';
import { Screen } from '../../src/components/Screen';
import { defaultProStatus, isProStatus } from '../../src/features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../src/features/account/accountQueries';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const benefits = [
  {
    body: '邀请监督搭子，互相轻轻盯一下。',
    icon: UsersRound,
    title: '监督搭子',
  },
  {
    body: '未来会把菊花抬和蹲会儿带到手表上。',
    icon: Watch,
    title: 'Apple Watch 联动',
  },
  {
    body: '看 90 天节奏，知道自己哪里越来越稳。',
    icon: FileChartColumnIncreasing,
    title: '高级小报告',
  },
];

export default function ProScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const proStatus = useEntitlementsQuery().data?.proStatus ?? defaultProStatus;
  const user = useCurrentUserQuery().data;
  const isPro = isProStatus(proStatus);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.me} title="小提督 Pro" />
      <PageHeader
        eyebrow="Pro"
        subtitle="基础功能继续免费，Pro 解锁搭子监督、手表联动和更长周期的小报告。"
        title="多一点陪伴，不多一点压力"
      />

      <PageStack gap="regular">
        <AppCard muted style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Crown color={colors.primaryPressed} size={30} strokeWidth={2.4} />
          </View>
          <Text style={styles.heroTitle}>{isPro ? 'Pro 已经开张' : '小提督 Pro'}</Text>
          <Text style={styles.heroBody}>
            {isPro ? '监督搭子和高级小报告已经可以使用。' : '真实订阅还在接入中，当前用于本地联调和权益展示。'}
          </Text>
        </AppCard>

        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <AppCard key={benefit.title} style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <Icon color={colors.primaryPressed} size={22} strokeWidth={2.4} />
              </View>
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitBody}>{benefit.body}</Text>
              </View>
            </AppCard>
          );
        })}

        {!user ? (
          <AppButton onPress={() => router.push(routes.me)}>先去我的页面登录</AppButton>
        ) : (
          <AppButton disabled variant="secondary">
            购买与恢复订阅开发中
          </AppButton>
        )}
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    benefitBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
    },
    benefitCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    benefitCopy: {
      flex: 1,
    },
    benefitIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    benefitTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 4,
    },
    heroBody: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    heroCard: {
      alignItems: 'center',
      gap: 10,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
  });
}
