import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UsersRound } from 'lucide-react-native';

import { AppButton } from '../../../../src/components/AppButton';
import { AppCard } from '../../../../src/components/AppCard';
import { AppTopBar } from '../../../../src/components/AppTopBar';
import { PageHeader } from '../../../../src/components/PageHeader';
import { PageStack } from '../../../../src/components/PageStack';
import { Screen } from '../../../../src/components/Screen';
import { useAuthStore } from '../../../../src/features/account/authStore';
import { useTeamStore } from '../../../../src/features/team/teamStore';
import { routes } from '../../../../src/navigation/routes';
import { useAppTheme } from '../../../../src/theme/themeProvider';

export default function JoinTeamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const loginWithMockApple = useAuthStore((state) => state.loginWithMockApple);
  const user = useAuthStore((state) => state.user);
  const acceptInvite = useTeamStore((state) => state.acceptInvite);
  const error = useTeamStore((state) => state.error);
  const invitePreview = useTeamStore((state) => state.invitePreview);
  const isLoading = useTeamStore((state) => state.isLoading);
  const isMutating = useTeamStore((state) => state.isMutating);
  const loadInvitePreview = useTeamStore((state) => state.loadInvitePreview);

  useEffect(() => {
    if (token) {
      void loadInvitePreview(token);
    }
  }, [loadInvitePreview, token]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.team} title="加入小队" />
      <PageHeader eyebrow="监督搭子" subtitle="加入后你可以随时暂停共享或退出小队。" title="确认加入小队" />

      <PageStack>
        <AppCard style={styles.card}>
          <View style={styles.iconCircle}>
            <UsersRound color={colors.privacy} size={28} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>{invitePreview?.teamName ?? '小提督小队'}</Text>
          <Text style={styles.description}>
            {invitePreview
              ? `${invitePreview.inviterNickname ?? '搭子'} 邀请你加入。默认只共享低敏完成状态。`
              : isLoading
                ? '正在查看邀请...'
                : '邀请信息暂时不可用。'}
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!user ? (
            <AppButton onPress={() => void loginWithMockApple()}>先登录小提督</AppButton>
          ) : (
            <AppButton
              disabled={!token || isMutating}
              onPress={() => {
                if (!token) {
                  return;
                }

                void acceptInvite(token).then(() => router.replace(routes.team));
              }}
            >
              加入小队
            </AppButton>
          )}
        </AppCard>
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: 12,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      textAlign: 'center',
    },
    iconCircle: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
  });
}
