import { useRouter } from 'expo-router';
import { Bell, ChartNoAxesColumnIncreasing, Crown, UsersRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PressableScale } from '../../src/components/feedback/PressableScale';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { ProfileAvatar } from '../../src/components/ProfileAvatar';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/account/authStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function MeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accessToken = useAuthStore((state) => state.accessToken);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loginWithMockApple = useAuthStore((state) => state.loginWithMockApple);
  const logout = useAuthStore((state) => state.logout);
  const proStatus = useAuthStore((state) => state.proStatus);
  const refreshEntitlements = useAuthStore((state) => state.refreshEntitlements);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const uploadAvatar = useAuthStore((state) => state.uploadAvatar);
  const user = useAuthStore((state) => state.user);
  const [nicknameDraft, setNicknameDraft] = useState(user?.nickname ?? '');
  const normalizedNickname = nicknameDraft.trim();
  const hasProfileChanges = Boolean(
    user &&
      normalizedNickname !== (user.nickname ?? ''),
  );

  useEffect(() => {
    setNicknameDraft(user?.nickname ?? '');
  }, [user?.nickname]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="我的" />
      <PageHeader eyebrow="我的小提督" subtitle="账号、Pro 和搭子关系都放这里，本地记录仍然留在手机里。" title="我的" />

      <PageStack gap="loose">
        <AppCard style={styles.profileCard}>
          <View style={styles.headerLine}>
            <ProfileAvatar avatarUrl={user?.avatarUrl} nickname={user?.nickname} size="md" />
            <View style={styles.copy}>
              <Text style={styles.title}>{user ? user.nickname ?? '小提督用户' : '还没登录小提督'}</Text>
              <Text style={styles.description}>
                {user ? `当前权益：${formatProStatus(proStatus)}` : '登录后可以使用监督搭子、云端小队和高级小报告。'}
              </Text>
            </View>
          </View>

          {user ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>用户 ID</Text>
              <Text style={styles.statusValue}>{user.id}</Text>
            </View>
          ) : (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Pro 能力</Text>
              <Text style={styles.statusValue}>监督搭子、Apple Watch 和高级小报告会放在这里。</Text>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {accessToken ? (
            <>
              <View style={styles.profileEditor}>
                <Text style={styles.fieldLabel}>昵称</Text>
                <TextInput
                  maxLength={20}
                  onChangeText={setNicknameDraft}
                  placeholder="给自己取个轻松点的名字"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  value={nicknameDraft}
                />
                <Text style={styles.fieldLabel}>头像</Text>
                <View style={styles.avatarUploadRow}>
                  <ProfileAvatar avatarUrl={user?.avatarUrl} nickname={normalizedNickname || user?.nickname} size="sm" />
                  <View style={styles.copy}>
                    <Text style={styles.statusValue}>自定义头像</Text>
                    <Text style={styles.description}>会先压缩成小图，再通过对象存储上传骨架保存。</Text>
                  </View>
                </View>
                <AppButton disabled={isLoading} onPress={() => void uploadAvatar()} variant="secondary">
                  从相册选择头像
                </AppButton>
                <AppButton
                  disabled={!hasProfileChanges || isLoading || !normalizedNickname}
                  onPress={() =>
                    void updateProfile({
                      nickname: normalizedNickname,
                    })
                  }
                  variant="secondary"
                >
                  保存资料
                </AppButton>
              </View>
              <View style={styles.buttonGrid}>
                <AppButton
                  onPress={() => {
                    void refreshMe();
                    void refreshEntitlements();
                  }}
                  style={styles.flexButton}
                  variant="secondary"
                >
                  刷新
                </AppButton>
                <AppButton onPress={() => void logout()} style={styles.flexButton} variant="secondary">
                  退出登录
                </AppButton>
              </View>
            </>
          ) : (
            <View style={styles.loginActions}>
              <Text style={styles.description}>当前先用开发登录联调。真实 Apple 登录、Push 和灵动岛真机能力等 Apple Developer Program 准备好后再打开。</Text>
              <AppButton disabled={isLoading} onPress={() => void loginWithMockApple()} style={styles.primaryButton}>
                {isLoading ? '正在登录...' : '开发 Mock 登录'}
              </AppButton>
            </View>
          )}
        </AppCard>

        <PageSection subtitle="登录后再启用云端能力，本地记录不受影响。" title="云端能力">
          <AppCard style={styles.linksCard}>
            <MeLink
              body="查看会员权益，后续购买和恢复订阅也会放这里。"
              icon={Crown}
              onPress={() => router.push(routes.pro)}
              title="小提督 Pro"
              tone="primary"
            />
            <View style={styles.divider} />
            <MeLink
              body="拉个搭子，互相轻轻盯一下，只共享低敏状态。"
              icon={UsersRound}
              onPress={() => router.push(routes.team)}
              title="监督搭子"
              tone="privacy"
            />
            <View style={styles.divider} />
            <MeLink
              body="收到提醒就回个小暗号，不需要写小作文。"
              icon={Bell}
              onPress={() => router.push(routes.nudges)}
              title="搭子提醒"
              tone="privacy"
            />
            <View style={styles.divider} />
            <MeLink
              body="先看本地最近小报告，Pro 会补上更长周期回看。"
              icon={ChartNoAxesColumnIncreasing}
              onPress={() => router.push(routes.trends)}
              title="高级小报告"
              tone="info"
            />
          </AppCard>
        </PageSection>
      </PageStack>
    </Screen>
  );

}

type IconComponent = typeof Crown;

type MeLinkProps = {
  body: string;
  icon: IconComponent;
  onPress: () => void;
  title: string;
  tone: 'info' | 'primary' | 'privacy';
};

function MeLink({ body, icon: Icon, onPress, title, tone }: MeLinkProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const iconColor = tone === 'info' ? colors.info : tone === 'privacy' ? colors.privacy : colors.primaryPressed;
  const iconTone = tone === 'info' ? colors.infoSoft : tone === 'privacy' ? colors.surfaceMuted : colors.primarySoft;

  return (
    <PressableScale accessibilityLabel={`${title}，${body}`} onPress={onPress} style={styles.linkRow}>
      <View style={[styles.linkIcon, { backgroundColor: iconTone }]}>
        <Icon color={iconColor} size={20} strokeWidth={2.4} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkBody}>{body}</Text>
      </View>
    </PressableScale>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    avatarUploadRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 12,
      padding: 12,
    },
    buttonGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    copy: {
      flex: 1,
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    divider: {
      backgroundColor: colors.border,
      height: 1,
      marginLeft: 48,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    flexButton: {
      flex: 1,
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },
    headerLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    linkBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    linkIcon: {
      alignItems: 'center',
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    linkRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 68,
      paddingHorizontal: 4,
      paddingVertical: 10,
    },
    linkTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 4,
    },
    linksCard: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    loginActions: {
      gap: 10,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      minHeight: 46,
      paddingHorizontal: 14,
    },
    primaryButton: {
      marginTop: 2,
    },
    profileEditor: {
      gap: 10,
    },
    profileCard: {
      gap: 16,
    },
    statusBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      padding: 14,
    },
    statusLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 5,
    },
    statusValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 4,
    },
  });
}

function formatProStatus(status: ReturnType<typeof useAuthStore.getState>['proStatus']) {
  switch (status) {
    case 'pro_active':
      return 'Pro 已开启';
    case 'pro_grace_period':
      return 'Pro 宽限期';
    case 'pro_expired':
      return 'Pro 已过期';
    case 'free':
    default:
      return '免费版';
  }
}
