import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ChevronRight, Crown, Settings, Watch } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { ProStatus } from '@xiaotidu/contracts';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { PressableScale } from '../../src/components/feedback/PressableScale';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { ProfileAvatar } from '../../src/components/ProfileAvatar';
import { Screen } from '../../src/components/Screen';
import { defaultProStatus } from '../../src/features/account/accountModel';
import { useCurrentUserQuery, useEntitlementsQuery } from '../../src/features/account/accountQueries';
import { mockUserIds, useAuthStore } from '../../src/features/account/authStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

const accountLinks = [
  {
    description: '外观、提醒和蹲会儿相关设置',
    href: routes.settings,
    icon: Settings,
    title: '设置',
  },
  {
    description: '权益状态和订阅入口',
    href: routes.pro,
    icon: Crown,
    title: '小提督 Pro',
  },
  {
    description: '查看手表同步状态',
    href: routes.watch,
    icon: Watch,
    title: 'Apple Watch',
  },
] satisfies readonly {
  description: string;
  href: Href;
  icon: typeof Crown;
  title: string;
}[];

export default function MeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const authIsLoading = useAuthStore((state) => state.isLoading);
  const loginWithMockApple = useAuthStore((state) => state.loginWithMockApple);
  const logout = useAuthStore((state) => state.logout);
  const selectedMockUserId = useAuthStore((state) => state.selectedMockUserId);
  const { data: user, isFetching: isFetchingUser, refetch: refetchCurrentUser } = useCurrentUserQuery();
  const {
    data: entitlements,
    isFetching: isFetchingEntitlements,
    refetch: refetchEntitlements,
  } = useEntitlementsQuery();
  const proStatus = entitlements?.proStatus ?? defaultProStatus;
  const isLoading = authIsLoading || isFetchingUser || isFetchingEntitlements;

  function handleRefresh() {
    void refetchCurrentUser();
    void refetchEntitlements();
  }

  return (
    <Screen>
      <PageHeader subtitle="账号、设置和已开通的能力都在这里。" title="我的" />
      <PageStack gap="loose">
        <AppCard style={styles.profileCard}>
          <View style={styles.profileTop}>
            <ProfileAvatar avatarUrl={user?.avatarUrl} nickname={user?.nickname} size="lg" />
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>
                {user?.nickname ?? '还没登录小提督'}
              </Text>
              <Text style={styles.profileStatus}>{user ? formatProStatus(proStatus) : '登录后同步云端能力'}</Text>
            </View>
          </View>

          {user ? (
            <>
              <View style={styles.userIdBox}>
                <Text style={styles.userIdLabel}>用户 ID</Text>
                <Text numberOfLines={1} selectable style={styles.userIdValue}>
                  {user.id}
                </Text>
              </View>
              <AppButton onPress={() => router.push(routes.meProfile)}>编辑资料</AppButton>
            </>
          ) : (
            <>
              <Text style={styles.loginHint}>开发期可以先用 Mock 账号验证云端同步、好友和 Pro 入口。</Text>
              <AppButton disabled={isLoading} onPress={() => void loginWithMockApple()}>
                开发 Mock 登录
              </AppButton>
            </>
          )}
        </AppCard>

        {__DEV__ ? (
          <PageSection title="开发账号">
            <View style={styles.mockUsers}>
              {mockUserIds.map((mockUserId) => (
                <AppButton
                  disabled={isLoading}
                  key={mockUserId}
                  onPress={() => void loginWithMockApple(mockUserId)}
                  style={styles.mockUserButton}
                  variant={selectedMockUserId === mockUserId && user ? 'primary' : 'secondary'}
                >
                  {mockUserId.slice(-1).toUpperCase()}
                </AppButton>
              ))}
            </View>
          </PageSection>
        ) : null}

        <PageSection title="应用与账号">
          <AppCard style={styles.linkList}>
            {accountLinks.map((item, index) => {
              const Icon = item.icon;

              return (
                <PressableScale
                  accessibilityLabel={item.title}
                  key={item.title}
                  onPress={() => router.push(item.href)}
                  style={[styles.linkRow, index < accountLinks.length - 1 ? styles.linkDivider : null]}
                >
                  <View style={styles.linkIcon}>
                    <Icon color={colors.primaryPressed} size={20} strokeWidth={2.4} />
                  </View>
                  <View style={styles.linkCopy}>
                    <Text style={styles.linkTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.linkDescription}>
                      {item.description}
                    </Text>
                  </View>
                  <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2.4} />
                </PressableScale>
              );
            })}
          </AppCard>
        </PageSection>

        {user ? (
          <PageSection title="账号操作">
            <View style={styles.accountActions}>
              <AppButton disabled={isLoading} onPress={handleRefresh} style={styles.actionButton} variant="secondary">
                刷新
              </AppButton>
              <AppButton
                disabled={isLoading}
                onPress={() => void logout()}
                style={styles.actionButton}
                variant="secondary"
              >
                退出登录
              </AppButton>
            </View>
          </PageSection>
        ) : null}
      </PageStack>
    </Screen>
  );
}

function formatProStatus(proStatus: ProStatus) {
  switch (proStatus) {
    case 'pro_active':
      return '小提督 Pro';
    case 'pro_grace_period':
      return 'Pro 宽限期';
    case 'pro_expired':
      return 'Pro 已过期';
    case 'free':
    default:
      return '免费版';
  }
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    accountActions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
    },
    linkCopy: {
      flex: 1,
      gap: 3,
    },
    linkDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    linkDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    linkIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    linkList: {
      padding: 0,
    },
    linkRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 72,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    linkTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 21,
    },
    loginHint: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
    },
    mockUserButton: {
      flex: 1,
      minHeight: 44,
    },
    mockUsers: {
      flexDirection: 'row',
      gap: 10,
    },
    profileCard: {
      gap: 18,
    },
    profileCopy: {
      flex: 1,
      gap: 5,
    },
    profileName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 29,
    },
    profileStatus: {
      color: colors.primaryPressed,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
    },
    profileTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    userIdBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    userIdLabel: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 16,
    },
    userIdValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
  });
}
