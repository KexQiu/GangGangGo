import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link2 } from 'lucide-react-native';

import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { AppTopBar } from '../../../src/components/AppTopBar';
import { PageHeader } from '../../../src/components/PageHeader';
import { PageStack } from '../../../src/components/PageStack';
import { Screen } from '../../../src/components/Screen';
import { useTeamStore } from '../../../src/features/team/teamStore';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

export default function TeamInviteScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const createInvite = useTeamStore((state) => state.createInvite);
  const error = useTeamStore((state) => state.error);
  const invite = useTeamStore((state) => state.invite);
  const isMutating = useTeamStore((state) => state.isMutating);

  useEffect(() => {
    if (!invite) {
      void createInvite();
    }
  }, [createInvite, invite]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.team} title="邀请搭子" />
      <PageHeader eyebrow="监督搭子" subtitle="邀请链接只展示一次。对方加入后，只会看到你允许共享的低敏状态。" title="拉个搭子进小队" />

      <PageStack>
        <AppCard style={styles.card}>
          <View style={styles.iconCircle}>
            <Link2 color={colors.privacy} size={26} strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>{invite ? '邀请已生成' : '正在生成邀请'}</Text>
          <Text style={styles.description}>
            {invite ? '把下面的链接发给搭子。过期或使用后，需要重新生成。' : '小提督正在准备一张低调的邀请卡。'}
          </Text>
          {invite ? (
            <View style={styles.linkBox}>
              <Text selectable style={styles.linkText}>
                {invite.inviteUrl}
              </Text>
              <Text selectable style={styles.tokenText}>
                Token: {invite.token}
              </Text>
            </View>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton disabled={isMutating} onPress={() => void createInvite()} variant="secondary">
            重新生成
          </AppButton>
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
    linkBox: {
      alignSelf: 'stretch',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      gap: 8,
      padding: 14,
    },
    linkText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
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
