import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BuddyNudgeDailyLimit, QuietRange } from '@xiaotidu/contracts';

import { AppButton } from '../../../../src/components/AppButton';
import { AppCard } from '../../../../src/components/AppCard';
import { AppTopBar } from '../../../../src/components/AppTopBar';
import { PageHeader } from '../../../../src/components/PageHeader';
import { PageStack } from '../../../../src/components/PageStack';
import { Screen } from '../../../../src/components/Screen';
import { useCurrentUserQuery } from '../../../../src/features/account/accountQueries';
import { useNudgeSettingsQuery, useUpdateNudgeSettingsMutation } from '../../../../src/features/nudges/nudgeQueries';
import { useCurrentTeamQuery, useRemoveTeamMemberMutation } from '../../../../src/features/team/teamQueries';
import { routes } from '../../../../src/navigation/routes';
import { useAppTheme } from '../../../../src/theme/themeProvider';

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
  const currentUser = useCurrentUserQuery().data;
  const nudgeSettingsQuery = useNudgeSettingsQuery();
  const updateSettings = useUpdateNudgeSettingsMutation();
  const teamQuery = useCurrentTeamQuery();
  const removeMember = useRemoveTeamMemberMutation();
  const team = teamQuery.data?.team;
  const member = team?.members.find((item) => item.user.id === userId);
  const me = team?.members.find((item) => item.user.id === currentUser?.id);
  const nudgeSetting = useMemo(
    () => nudgeSettingsQuery.data?.settings.find((item) => item.buddyUserId === userId),
    [nudgeSettingsQuery.data, userId],
  );
  const isMe = userId === currentUser?.id;
  const canManageMember = me?.role === 'owner' && !isMe && member?.role !== 'owner';

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.team} title="搭子详情" />
      <PageHeader
        subtitle="提醒只用固定暗号，不开放自由文本。"
        title={member?.displayName ?? member?.user.nickname ?? '小提督搭子'}
      />

      <PageStack gap="regular">
        {!isMe && userId ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>允许 TA 提醒我</Text>
            <Text style={styles.description}>这里控制这个搭子每天最多能戳你几次。</Text>
            <View style={styles.chipGrid}>
              {limits.map((limit) => (
                <AppButton
                  key={limit}
                  onPress={() =>
                    updateSettings.mutate({
                      buddyUserId: userId,
                      settings: {
                        dailyLimit: limit,
                        enabled: limit > 0,
                        quietRanges: nudgeSetting?.quietRanges ?? [],
                      },
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
                    updateSettings.mutate({
                      buddyUserId: userId,
                      settings: {
                        dailyLimit: nudgeSetting?.dailyLimit ?? 5,
                        enabled: nudgeSetting?.enabled ?? true,
                        quietRanges: preset.ranges,
                      },
                    })
                  }
                  style={styles.chipButton}
                  variant={isSameQuietRanges(nudgeSetting?.quietRanges ?? [], preset.ranges) ? 'primary' : 'secondary'}
                >
                  {preset.label}
                </AppButton>
              ))}
            </View>
            <Text style={styles.description}>
              当前：
              {nudgeSetting?.quietRanges.length
                ? nudgeSetting.quietRanges.map((range) => `${range.start}-${range.end}`).join('、')
                : '没有额外勿扰'}
            </Text>
          </AppCard>
        ) : null}

        {canManageMember && member ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>移除成员</Text>
            <Text style={styles.description}>移除后，对方不能继续看到小队新状态。</Text>
            <AppButton
              onPress={() => {
                removeMember.mutate(member.id, { onSuccess: () => router.replace(routes.team) });
              }}
              variant="warning"
            >
              移除这个搭子
            </AppButton>
          </AppCard>
        ) : null}
      </PageStack>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  });
}

function isSameQuietRanges(left: QuietRange[], right: QuietRange[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((range, index) => {
    const comparedRange = right[index];
    return comparedRange?.start === range.start && comparedRange.end === range.end;
  });
}
