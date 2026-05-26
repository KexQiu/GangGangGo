import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BuddyNudgeDailyLimit, BuddyNudgeType, QuietRange } from '@xiaotidu/contracts';

import { AppButton } from '../../../../src/components/AppButton';
import { AppCard } from '../../../../src/components/AppCard';
import { AppTopBar } from '../../../../src/components/AppTopBar';
import { PageHeader } from '../../../../src/components/PageHeader';
import { PageStack } from '../../../../src/components/PageStack';
import { Screen } from '../../../../src/components/Screen';
import { isProStatus, useAuthStore } from '../../../../src/features/account/authStore';
import { nudgeCopies, useNudgeStore } from '../../../../src/features/nudges/nudgeStore';
import { useTeamStore } from '../../../../src/features/team/teamStore';
import { routes } from '../../../../src/navigation/routes';
import { useAppTheme } from '../../../../src/theme/themeProvider';

const nudgeTypes: BuddyNudgeType[] = ['move', 'not_blank', 'habit_left', 'posture'];
const limits: BuddyNudgeDailyLimit[] = [0, 3, 5, 8];
const quietPresets: Array<{ label: string; ranges: QuietRange[] }> = [
  { label: '关闭勿扰', ranges: [] },
  { label: '午休', ranges: [{ end: '14:00', start: '12:00' }] },
  { label: '夜间', ranges: [{ end: '08:00', start: '22:00' }] },
  {
    label: '午休+夜间',
    ranges: [
      { end: '14:00', start: '12:00' },
      { end: '08:00', start: '22:00' },
    ],
  },
];

export default function TeamMemberScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const currentUser = useAuthStore((state) => state.user);
  const proStatus = useAuthStore((state) => state.proStatus);
  const isPro = isProStatus(proStatus);
  const error = useNudgeStore((state) => state.error);
  const isMutating = useNudgeStore((state) => state.isMutating);
  const loadSettings = useNudgeStore((state) => state.loadSettings);
  const sendNudge = useNudgeStore((state) => state.sendNudge);
  const settings = useNudgeStore((state) => state.settings);
  const updateSettings = useNudgeStore((state) => state.updateSettings);
  const loadCurrentTeam = useTeamStore((state) => state.loadCurrentTeam);
  const removeMember = useTeamStore((state) => state.removeMember);
  const team = useTeamStore((state) => state.team);
  const member = team?.members.find((item) => item.user.id === userId);
  const me = team?.members.find((item) => item.user.id === currentUser?.id);
  const nudgeSetting = useMemo(
    () => settings.find((item) => item.buddyUserId === userId),
    [settings, userId],
  );
  const isMe = userId === currentUser?.id;
  const canManageMember = me?.role === 'owner' && !isMe && member?.role !== 'owner';

  useEffect(() => {
    void loadCurrentTeam();
    void loadSettings();
  }, [loadCurrentTeam, loadSettings]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.team} title="搭子详情" />
      <PageHeader eyebrow="监督搭子" subtitle="提醒只用固定暗号，不开放自由文本。" title={member?.displayName ?? member?.user.nickname ?? '小提督搭子'} />

      <PageStack gap="regular">
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>轻轻戳一下</Text>
          <Text style={styles.description}>每天提醒次数由对方设置，命中勿扰时间时不会打扰。</Text>
          {isMe ? <Text style={styles.description}>这是你自己。自己的提醒设置在小队设置里处理。</Text> : null}
          <View style={styles.buttonGrid}>
            {nudgeTypes.map((type) => (
              <AppButton
                disabled={isMe || !isPro || isMutating}
                key={type}
                onPress={() => {
                  if (!userId) {
                    return;
                  }

                  void sendNudge(userId, type);
                }}
                style={styles.gridButton}
                variant="secondary"
              >
                {nudgeCopies[type]}
              </AppButton>
            ))}
          </View>
          {!isPro && !isMe ? <Text style={styles.errorText}>主动提醒搭子需要小提督 Pro。</Text> : null}
        </AppCard>

        {!isMe && userId ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>允许 TA 提醒我</Text>
            <Text style={styles.description}>这里控制这个搭子每天最多能戳你几次。</Text>
            <View style={styles.chipGrid}>
              {limits.map((limit) => (
                <AppButton
                  key={limit}
                  onPress={() =>
                    void updateSettings(userId, {
                      dailyLimit: limit,
                      enabled: limit > 0,
                      quietRanges: nudgeSetting?.quietRanges ?? [],
                    })
                  }
                  style={styles.chipButton}
                  variant={nudgeSetting?.dailyLimit === limit ? 'primary' : 'secondary'}
                >
                  {limit === 0 ? '关闭' : `${limit} 次`}
                </AppButton>
              ))}
            </View>

            <Text style={styles.cardTitle}>勿扰时间</Text>
            <View style={styles.chipGrid}>
              {quietPresets.map((preset) => (
                <AppButton
                  key={preset.label}
                  onPress={() =>
                    void updateSettings(userId, {
                      dailyLimit: nudgeSetting?.dailyLimit ?? 5,
                      enabled: nudgeSetting?.enabled ?? true,
                      quietRanges: preset.ranges,
                    })
                  }
                  style={styles.chipButton}
                  variant="secondary"
                >
                  {preset.label}
                </AppButton>
              ))}
            </View>
            <Text style={styles.description}>
              当前：{nudgeSetting?.quietRanges.length ? nudgeSetting.quietRanges.map((range) => `${range.start}-${range.end}`).join('、') : '没有额外勿扰'}
            </Text>
          </AppCard>
        ) : null}

        {canManageMember && member ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>移除成员</Text>
            <Text style={styles.description}>移除后，对方不能继续看到小队新状态。</Text>
            <AppButton
              onPress={() => {
                void removeMember(member.id).then(() => router.replace(routes.team));
              }}
              variant="warning"
            >
              移除这个搭子
            </AppButton>
          </AppCard>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    buttonGrid: {
      gap: 10,
    },
    card: {
      gap: 12,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    chipButton: {
      flexBasis: '47%',
      minHeight: 44,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    gridButton: {
      minHeight: 44,
    },
  });
}
