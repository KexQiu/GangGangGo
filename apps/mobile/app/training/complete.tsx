import { useAuthStore } from '../../src/features/account/authStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { trainingSafetyGuidance } from '../../src/features/safety/healthGuidance';
import { getTrainingPreset } from '../../src/features/training/presets';
import { formatTrainingDuration, formatTrainingEndReason } from '../../src/features/training/trainingLogic';
import type { TrainingSession } from '../../src/features/training/trainingTypes';
import { getTrainingSession } from '../../src/storage/repositories/trainingRepository';
import { useReminderStore } from '../../src/features/reminders/reminderStore';
import { authSessionContext } from '../../src/api/sessionContext';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingCompleteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reminder = useReminderStore();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  useEffect(() => {
    let cancelled = false;
    const generation = authSessionContext.getGeneration();
    setSession(null);
    setError(null);
    const unsubscribe = useAuthStore.subscribe(() => {
      if (!authSessionContext.isGenerationCurrent(generation)) {
        setSession(null);
        setError('账号已切换，请返回后查看当前资料。');
      }
    });
    void getTrainingSession(id ?? '')
      .then((record) => {
        if (!cancelled && authSessionContext.isGenerationCurrent(generation)) {
          setSession(record);
          if (!record) setError('未找到这条记录。');
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error instanceof Error ? error.message : '读取失败');
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id]);
  return (
    <Screen>
      <AppTopBar fallbackHref={routes.home} title="菊花抬记录" variant="close" />
      <PageHeader
        title={session ? '记录已保存' : error ? '暂时无法显示记录' : '读取记录中'}
        subtitle="记录不代表动作质量或训练量适合个人，不必为凑次数加练。"
      />
      {session && (
        <AppCard muted style={styles.resultCard}>
          <Text style={styles.resultTitle}>{getTrainingPreset(session.presetId).name}</Text>
          <Text style={styles.resultText}>
            收缩 {session.plan.contractSeconds} 秒 · 放松 {session.plan.relaxSeconds} 秒
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatTrainingDuration(session.durationSeconds)}</Text>
              <Text style={styles.statLabel}>有效用时</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {session.completedRepetitions}/{session.plan.repetitions}
              </Text>
              <Text style={styles.statLabel}>完整次数</Text>
            </View>
          </View>
          <Text style={styles.resultText}>
            {formatTrainingEndReason(session.endReason)} ·{' '}
            {session.feedback === 'reported' ? '有不适' : session.feedback === 'none' ? '无不适' : '未反馈'}
          </Text>
        </AppCard>
      )}
      <AppCard style={styles.safetyCard}>
        <Text style={styles.safetyText}>{trainingSafetyGuidance}</Text>
      </AppCard>
      {session?.feedback === 'reported' && (
        <AppButton
          disabled={reminder.isSyncing || !reminder.settings.kegelEnabled}
          variant="warning"
          onPress={() => void reminder.updateSettings({ kegelEnabled: false })}
        >
          {reminder.settings.kegelEnabled ? '暂停训练提醒' : '训练提醒已关闭，需手动开启'}
        </AppButton>
      )}
      {(error || reminder.error) && (
        <Text accessibilityRole="alert" style={styles.safetyText}>
          {error ?? reminder.error}
        </Text>
      )}
      <AppButton onPress={() => router.push(routes.safety)} variant="secondary">
        查看安全与就医说明
      </AppButton>
      <View style={styles.actions}>
        <AppButton onPress={() => router.replace(routes.training)} style={styles.actionButton} variant="secondary">
          返回训练
        </AppButton>
        <AppButton onPress={() => router.replace(routes.home)} style={styles.actionButton}>
          回到首页
        </AppButton>
      </View>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    resultCard: {
      alignItems: 'center',
      marginBottom: 16,
      overflow: 'hidden',
      paddingVertical: 32,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 8,
    },
    resultText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 21,
      marginBottom: 24,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      width: '100%',
    },
    statItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      flex: 1,
      marginHorizontal: 5,
      paddingVertical: 16,
    },
    statValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 6,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    safetyCard: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 16,
    },
    safetyText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      marginLeft: 10,
    },
    actions: {
      flexDirection: 'row',
      marginBottom: 14,
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
  });
}
