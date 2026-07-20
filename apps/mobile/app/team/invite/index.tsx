import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Link2, QrCode } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { AppTopBar } from '../../../src/components/AppTopBar';
import { PageHeader } from '../../../src/components/PageHeader';
import { PageStack } from '../../../src/components/PageStack';
import { Screen } from '../../../src/components/Screen';
import { useCreateTeamInviteMutation } from '../../../src/features/team/teamQueries';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

export default function TeamInviteScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { data: invite, error, isPending: isMutating, mutate: createInvite } = useCreateTeamInviteMutation();
  const [feedback, setFeedback] = useState<null | string>(null);

  useEffect(() => {
    if (!invite) {
      createInvite();
    }
  }, [createInvite, invite]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeout = setTimeout(() => setFeedback(null), 2600);

    return () => clearTimeout(timeout);
  }, [feedback]);

  async function copyInviteLink() {
    if (!invite) {
      return;
    }

    try {
      await Clipboard.setStringAsync(invite.inviteUrl);
      setFeedback('链接已复制，可以发给搭子了。');
    } catch {
      setFeedback('复制失败了，可以长按链接手动复制。');
    }
  }

  async function shareInvite() {
    if (!invite) {
      return;
    }

    try {
      await Share.share({
        message: buildShareMessage(invite.inviteUrl),
        url: invite.inviteUrl,
      });
    } catch {
      setFeedback('分享没有完成，可以复制链接发送。');
    }
  }

  function generateNewInvite() {
    setFeedback(null);
    createInvite();
  }

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.team} title="邀请搭子" />
      <PageHeader
        eyebrow="监督搭子"
        subtitle="发给一个信得过的人。对方加入后，只会看到你允许共享的低敏状态。"
        title="拉个搭子进小队"
      />

      <PageStack>
        <AppCard style={styles.card}>
          <View style={styles.iconCircle}>
            <Link2 color={colors.privacy} size={26} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>{invite ? '邀请卡已准备好' : isMutating ? '正在生成邀请' : '邀请暂时没生成'}</Text>
          <Text style={styles.description}>
            {invite
              ? '可以分享链接，也可以让搭子扫码打开。旧链接不会因为你生成新链接而自动失效。'
              : error
                ? '生成失败了，可以稍后重试。'
                : '小提督正在准备一张低调的邀请卡。'}
          </Text>
          {invite ? (
            <>
              <View style={styles.qrPanel}>
                <QRCode value={invite.inviteUrl} size={176} color="#1F2A24" backgroundColor="#FFFFFF" />
              </View>
              <View style={styles.linkBox}>
                <Text style={styles.linkLabel}>邀请链接</Text>
                <Text selectable style={styles.linkText}>
                  {invite.inviteUrl}
                </Text>
                <Text style={styles.tokenText}>{formatExpiresAt(invite.expiresAt)}</Text>
              </View>
              <View style={styles.privacyBox}>
                <View style={styles.privacyTitleLine}>
                  <QrCode color={colors.privacy} size={18} strokeWidth={2.4} />
                  <Text style={styles.privacyTitle}>加入后能看到什么</Text>
                </View>
                <Text style={styles.privacyText}>只共享训练完成、小账本进度、是否记录蹲会儿和连续天数。</Text>
                <Text style={styles.privacyText}>不会共享具体时长、身体不适、备注和本地隐私记录。</Text>
              </View>
            </>
          ) : null}
          {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
          {invite ? (
            <View style={styles.actionRow}>
              <AppButton disabled={isMutating} onPress={() => void shareInvite()} style={styles.flexButton}>
                分享邀请
              </AppButton>
              <AppButton
                disabled={isMutating}
                onPress={() => void copyInviteLink()}
                style={styles.flexButton}
                variant="secondary"
              >
                复制链接
              </AppButton>
            </View>
          ) : null}
          <AppButton disabled={isMutating} onPress={generateNewInvite} variant="secondary">
            {invite ? '生成新链接' : isMutating ? '生成中...' : '重新尝试'}
          </AppButton>
        </AppCard>
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 10,
    },
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
    feedbackText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 19,
      textAlign: 'center',
    },
    flexButton: {
      flex: 1,
    },
    iconCircle: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    linkBox: {
      alignSelf: 'stretch',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      gap: 8,
      padding: 14,
    },
    linkLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    linkText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    privacyBox: {
      alignSelf: 'stretch',
      backgroundColor: colors.primarySoft,
      borderRadius: 16,
      gap: 6,
      padding: 14,
    },
    privacyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    privacyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    privacyTitleLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 2,
    },
    qrPanel: {
      backgroundColor: '#FFFFFF',
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      padding: 14,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    tokenText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
  });
}

function buildShareMessage(inviteUrl: string) {
  return `我想邀请你加入小提督监督搭子小队。加入后只共享低敏完成状态，不会看到具体隐私记录。\n${inviteUrl}`;
}

function formatExpiresAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '有效期 7 天';
  }

  return `有效期至 ${new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date)}`;
}
