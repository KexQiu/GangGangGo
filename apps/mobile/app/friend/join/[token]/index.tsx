import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserRoundPlus } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../src/components/AppButton';
import { AppCard } from '../../../../src/components/AppCard';
import { AppTopBar } from '../../../../src/components/AppTopBar';
import { PageHeader } from '../../../../src/components/PageHeader';
import { PageStack } from '../../../../src/components/PageStack';
import { ProfileAvatar } from '../../../../src/components/ProfileAvatar';
import { Screen } from '../../../../src/components/Screen';
import { useCurrentUserQuery } from '../../../../src/features/account/accountQueries';
import { useAuthStore } from '../../../../src/features/account/authStore';
import {
  useAcceptFriendInviteMutation,
  useFriendInvitePreviewQuery,
} from '../../../../src/features/friends/friendQueries';
import { routes } from '../../../../src/navigation/routes';
import { useAppTheme } from '../../../../src/theme/themeProvider';

export default function JoinFriendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const loginWithMockApple = useAuthStore((state) => state.loginWithMockApple);
  const authIsLoading = useAuthStore((state) => state.isLoading);
  const user = useCurrentUserQuery().data;
  const previewQuery = useFriendInvitePreviewQuery(token);
  const acceptInvite = useAcceptFriendInviteMutation();
  const preview = previewQuery.data;

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.friends} title="添加好友" />
      <PageHeader subtitle="确认后建立双向好友关系，所有权限默认关闭。" title="确认好友邀请" />
      <PageStack>
        <AppCard style={styles.card}>
          {preview ? (
            <ProfileAvatar avatarUrl={preview.inviter.avatarUrl} nickname={preview.inviter.nickname} size="lg" />
          ) : (
            <View style={styles.iconCircle}>
              <UserRoundPlus color={colors.privacy} size={28} strokeWidth={2.4} />
            </View>
          )}
          {previewQuery.isFetching && !preview ? <ActivityIndicator color={colors.primaryPressed} /> : null}
          <Text style={styles.title}>{preview?.inviter.nickname ?? '好友邀请'}</Text>
          <Text style={styles.description}>
            {preview ? '邀请你成为小提督好友。添加后不会自动看到彼此的健康数据。' : '邀请可能已经过期或被使用。'}
          </Text>
          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>默认关闭</Text>
            <Text style={styles.description}>三类数据查看权限、我收工时通知 TA、允许接收 TA 的收工通知。</Text>
          </View>
          {!user && preview ? (
            <AppButton disabled={authIsLoading} onPress={() => void loginWithMockApple()}>
              {authIsLoading ? '登录中...' : '先登录小提督'}
            </AppButton>
          ) : (
            <AppButton
              disabled={!preview || !token || acceptInvite.isPending}
              onPress={() => {
                if (!token) return;
                acceptInvite.mutate(token, { onSuccess: () => router.replace(routes.friends) });
              }}
            >
              {acceptInvite.isPending ? '添加中...' : '确认添加好友'}
            </AppButton>
          )}
          {previewQuery.error ? <Text style={styles.error}>{previewQuery.error.message}</Text> : null}
        </AppCard>
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { alignItems: 'center', gap: 12 },
    description: { color: colors.textMuted, fontSize: 14, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
    error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
    iconCircle: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    privacyBox: { alignSelf: 'stretch', backgroundColor: colors.surfaceMuted, borderRadius: 16, gap: 6, padding: 14 },
    privacyTitle: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
    title: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  });
}
