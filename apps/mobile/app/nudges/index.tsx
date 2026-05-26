import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { PageSection, PageStack } from '../../src/components/PageStack';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/account/authStore';
import { ackCopies, nudgeCopies, useNudgeStore } from '../../src/features/nudges/nudgeStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function NudgesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const ackNudge = useNudgeStore((state) => state.ackNudge);
  const error = useNudgeStore((state) => state.error);
  const inbox = useNudgeStore((state) => state.inbox);
  const isLoading = useNudgeStore((state) => state.isLoading);
  const loadInbox = useNudgeStore((state) => state.loadInbox);
  const loadSent = useNudgeStore((state) => state.loadSent);
  const sent = useNudgeStore((state) => state.sent);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void loadInbox();
    void loadSent();
  }, [accessToken, loadInbox, loadSent]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.me} title="搭子提醒" />
      <PageHeader eyebrow="小队暗号" subtitle="收到就轻轻回一下，不需要写小作文。" title="提醒和回执" />

      <PageStack gap="regular">
        {!user ? (
          <AppCard style={styles.loginCard}>
            <Bell color={colors.privacy} size={28} strokeWidth={2.4} />
            <Text style={styles.loginTitle}>先登录小提督</Text>
            <Text style={styles.emptyText}>登录后才能查看搭子提醒和回执。</Text>
            <AppButton onPress={() => router.push(routes.me)}>去我的页面登录</AppButton>
          </AppCard>
        ) : null}

        {user ? (
          <>
            <PageSection title="收到的提醒">
              {inbox.length === 0 ? (
                <AppCard muted>
                  <Text style={styles.emptyText}>{isLoading ? '正在看看有没有搭子来敲门...' : '现在没有新的搭子提醒。'}</Text>
                </AppCard>
              ) : (
                inbox.map((nudge) => (
                  <AppCard key={nudge.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{nudge.fromUser.nickname ?? '搭子'}：{nudgeCopies[nudge.type]}</Text>
                    <Text style={styles.description}>{nudge.messageTemplate}</Text>
                    {nudge.ack ? (
                      <Text style={styles.ackText}>已回执：{ackCopies[nudge.ack.status]}</Text>
                    ) : (
                      <View style={styles.buttonGrid}>
                        {(['received', 'later', 'done'] as const).map((status) => (
                          <AppButton
                            key={status}
                            onPress={() => void ackNudge(nudge.id, status)}
                            style={styles.flexButton}
                            variant="secondary"
                          >
                            {ackCopies[status]}
                          </AppButton>
                        ))}
                      </View>
                    )}
                  </AppCard>
                ))
              )}
            </PageSection>

            <PageSection title="我发出的提醒">
              {sent.length === 0 ? (
                <AppCard muted>
                  <Text style={styles.emptyText}>还没戳过搭子。小队页里可以轻轻戳一下。</Text>
                </AppCard>
              ) : (
                sent.map((nudge) => (
                  <AppCard key={nudge.id} style={styles.card}>
                    <Text style={styles.cardTitle}>给 {nudge.toUser.nickname ?? '搭子'}：{nudgeCopies[nudge.type]}</Text>
                    <Text style={styles.description}>
                      {nudge.ack ? `对方回了：${ackCopies[nudge.ack.status]}` : '等待对方回个小暗号。'}
                    </Text>
                  </AppCard>
                ))
              )}
            </PageSection>
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ackText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
    },
    buttonGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    card: {
      gap: 10,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 21,
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 21,
      textAlign: 'center',
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    flexButton: {
      flex: 1,
      minHeight: 42,
    },
    loginCard: {
      alignItems: 'center',
      gap: 12,
    },
    loginTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
  });
}
