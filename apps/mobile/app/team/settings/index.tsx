import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../src/components/AppButton';
import { AppCard } from '../../../src/components/AppCard';
import { AppTopBar } from '../../../src/components/AppTopBar';
import { PageHeader } from '../../../src/components/PageHeader';
import { PageStack } from '../../../src/components/PageStack';
import { Screen } from '../../../src/components/Screen';
import { useCurrentUserQuery } from '../../../src/features/account/accountQueries';
import {
  useCurrentTeamQuery,
  useLeaveTeamMutation,
  useRenameTeamMutation,
  useTeamSnapshotsQuery,
  useUpdateMyMemberStatusMutation,
  useUpdateShareSettingsMutation,
} from '../../../src/features/team/teamQueries';
import { routes } from '../../../src/navigation/routes';
import { useAppTheme } from '../../../src/theme/themeProvider';

export default function TeamSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const user = useCurrentUserQuery().data;
  const teamQuery = useCurrentTeamQuery();
  const team = teamQuery.data?.team;
  const snapshotsQuery = useTeamSnapshotsQuery({ enabled: Boolean(team) });
  const snapshots = snapshotsQuery.data;
  const leaveTeam = useLeaveTeamMutation();
  const renameTeam = useRenameTeamMutation();
  const updateMyMemberStatus = useUpdateMyMemberStatusMutation();
  const updateShareSettings = useUpdateShareSettingsMutation();
  const isMutating =
    leaveTeam.isPending || renameTeam.isPending || updateMyMemberStatus.isPending || updateShareSettings.isPending;
  const [teamName, setTeamName] = useState(team?.name ?? '');
  const myMember = useMemo(() => team?.members.find((member) => member.user.id === user?.id), [team, user?.id]);
  const mySnapshot = snapshots?.snapshots.find((snapshot) => snapshot.member.id === myMember?.id);
  const shareSettings = mySnapshot?.shareSettings;

  useEffect(() => {
    setTeamName(team?.name ?? '');
  }, [team?.name]);

  return (
    <Screen>
      <AppTopBar fallbackHref={routes.team} title="小队设置" />
      <PageHeader eyebrow="共享边界" subtitle="你可以随时暂停共享，也可以只共享某些低敏状态。" title="小队和共享" />

      <PageStack gap="regular">
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>小队名称</Text>
          <TextInput
            onChangeText={setTeamName}
            placeholder="小提督小队"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            value={teamName}
          />
          <AppButton
            disabled={!teamName.trim() || isMutating}
            onPress={() => renameTeam.mutate(teamName.trim())}
            variant="secondary"
          >
            保存名称
          </AppButton>
        </AppCard>

        {shareSettings ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>我的共享</Text>
            <SettingSwitch
              description="关闭后，搭子暂时看不到你的今日状态。"
              onValueChange={(value) => updateMyMemberStatus.mutate(value ? 'paused' : 'active')}
              title="暂停共享"
              value={myMember?.status === 'paused' || shareSettings.paused}
            />
            <SettingSwitch
              description="只共享是否完成建议量。"
              onValueChange={(value) => updateShareSettings.mutate({ ...shareSettings, shareTraining: value })}
              title="菊花抬状态"
              value={shareSettings.shareTraining}
            />
            <SettingSwitch
              description="只共享 0/4 到 4/4，不共享具体判断。"
              onValueChange={(value) => updateShareSettings.mutate({ ...shareSettings, shareHabitCompletion: value })}
              title="小账本完成度"
              value={shareSettings.shareHabitCompletion}
            />
            <SettingSwitch
              description="只共享今天是否记过，不共享时长和感受。"
              onValueChange={(value) => updateShareSettings.mutate({ ...shareSettings, shareToiletRecorded: value })}
              title="蹲会儿是否记过"
              value={shareSettings.shareToiletRecorded}
            />
            <SettingSwitch
              description="共享连续满格天数，给搭子一点节奏线索。"
              onValueChange={(value) => updateShareSettings.mutate({ ...shareSettings, shareStreak: value })}
              title="连续天数"
              value={shareSettings.shareStreak}
            />
          </AppCard>
        ) : null}

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>离开小队</Text>
          <Text style={styles.description}>退出后，搭子不会再看到你的新状态。历史本地记录不会删除。</Text>
          <AppButton disabled={isMutating} onPress={() => leaveTeam.mutate()} variant="warning">
            退出小队
          </AppButton>
        </AppCard>
      </PageStack>
    </Screen>
  );
}

type SettingSwitchProps = {
  description: string;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
};

function SettingSwitch({ description, onValueChange, title, value }: SettingSwitchProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.switchLine}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        ios_backgroundColor={colors.border}
        onValueChange={onValueChange}
        thumbColor={value ? colors.primary : colors.surface}
        trackColor={{
          false: colors.border,
          true: colors.primarySoft,
        }}
        value={value}
      />
    </View>
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
    description: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      minHeight: 48,
      paddingHorizontal: 14,
    },
    switchCopy: {
      flex: 1,
    },
    switchLine: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 12,
      padding: 12,
    },
    switchTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 4,
    },
  });
}
