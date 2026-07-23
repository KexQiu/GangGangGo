import * as Clipboard from 'expo-clipboard';
import { Link2, QrCode } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { AppTopBar } from '../../../src/components/AppTopBar';
import { PageHeader } from '../../../src/components/PageHeader';
import { PageStack } from '../../../src/components/PageStack';
import { Screen } from '../../../src/components/Screen';
import { useCreateFriendInviteMutation } from '../../../src/features/friends/friendQueries';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

export default function FriendInviteScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const inviteMutation = useCreateFriendInviteMutation();
  const invite = inviteMutation.data;
  const createInvite = inviteMutation.mutate;
  const isInviteIdle = inviteMutation.isIdle;
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isInviteIdle) createInvite();
  }, [createInvite, isInviteIdle]);

  async function copyInvite() {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.inviteUrl);
    setFeedback('邀请链接已复制。');
  }

  async function shareInvite() {
    if (!invite) return;
    await Share.share({
      message: `加个小提督好友吧。确认后默认不共享健康数据，权限由双方各自设置。\n${invite.inviteUrl}`,
      url: invite.inviteUrl,
    });
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.friends} title="添加好友" />
      <PageHeader subtitle="对方确认后成为双向好友，默认不共享任何健康数据。" title="邀请一个好友" />
      <PageStack>
        <AppCard style={styles.card}>
          <View style={styles.iconCircle}>
            <Link2 color={colors.privacy} size={26} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>{invite ? '好友邀请已准备好' : '正在生成邀请'}</Text>
          <Text style={styles.description}>邀请单次有效，7 天后过期。双方都可以随时删除好友和全部互动历史。</Text>
          {invite ? (
            <>
              <View style={styles.qrPanel}>
                <QRCode backgroundColor="#FFFFFF" color="#1F2A24" size={176} value={invite.inviteUrl} />
              </View>
              <View style={styles.privacyBox}>
                <View style={styles.privacyTitleLine}>
                  <QrCode color={colors.privacy} size={18} strokeWidth={2.4} />
                  <Text style={styles.privacyTitle}>默认隐私状态</Text>
                </View>
                <Text style={styles.privacyText}>菊花抬、小账本和蹲会儿均不可见。</Text>
                <Text style={styles.privacyText}>双方的蹲会儿结束通知均默认关闭。</Text>
              </View>
              <Text selectable style={styles.linkText}>
                {invite.inviteUrl}
              </Text>
              <View style={styles.actionRow}>
                <AppButton onPress={() => void shareInvite()} style={styles.flexButton}>
                  分享邀请
                </AppButton>
                <AppButton onPress={() => void copyInvite()} style={styles.flexButton} variant="secondary">
                  复制链接
                </AppButton>
              </View>
            </>
          ) : null}
          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          {inviteMutation.error ? (
            <Text style={styles.error}>
              {inviteMutation.error instanceof Error ? inviteMutation.error.message : '生成邀请失败，请稍后重试。'}
            </Text>
          ) : null}
          <AppButton disabled={inviteMutation.isPending} onPress={() => createInvite()} variant="secondary">
            {invite ? '生成新邀请' : inviteMutation.isPending ? '生成中...' : '重新尝试'}
          </AppButton>
        </AppCard>
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 10 },
    card: { alignItems: 'center', gap: 12 },
    description: { color: colors.textMuted, fontSize: 14, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
    error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
    feedback: { color: colors.primaryPressed, fontSize: 13, fontWeight: '800' },
    flexButton: { flex: 1 },
    iconCircle: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    linkText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
    privacyBox: { alignSelf: 'stretch', backgroundColor: colors.primarySoft, borderRadius: 16, gap: 6, padding: 14 },
    privacyText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', lineHeight: 19 },
    privacyTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    privacyTitleLine: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    qrPanel: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 20, borderWidth: 1, padding: 14 },
    title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  });
}
