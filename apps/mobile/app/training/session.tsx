import { trainingSafetyGuidance } from '../../src/features/safety/healthGuidance';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { authSessionContext } from '../../src/api/sessionContext';
import { useTrainingClock } from '../../src/features/training/useTrainingClock';
import { createTrainingCompletion } from '../../src/features/training/trainingCompletion';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { Screen } from '../../src/components/Screen';
import { getTrainingPreset } from '../../src/features/training/presets';
import {
  buildTrainingTimeline,
  formatTrainingDuration,
  getCurrentTrainingStep,
  getPhaseCopy,
  getStepRemainingSeconds,
  getTimelineTotalSeconds,
} from '../../src/features/training/trainingLogic';
import { useTrainingStore } from '../../src/features/training/trainingStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ presetId?: string }>();
  const addSession = useTrainingStore((state) => state.addSession);
  const training = useTrainingClock(params.presetId);
  const preset = training.clock?.preset ?? getTrainingPreset(params.presetId);
  const timeline = useMemo(() => buildTrainingTimeline(preset), [preset]);
  const totalSeconds = getTimelineTotalSeconds(timeline);
  const { elapsedSeconds, isPaused } = training;
  const finishedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const completion = useRef<ReturnType<typeof createTrainingCompletion> | null>(null);
  completion.current ??= createTrainingCompletion(
    async ({ session, generation }) => {
      await addSession(session, { generation });
      authSessionContext.assertGeneration(generation);
      training.clear();
    },
    (session) =>
      router.replace({
        pathname: routes.trainingComplete,
        params: {
          completedRepetitions: session.completedRepetitions.toString(),
          durationSeconds: session.durationSeconds.toString(),
          isCompleted: session.isCompleted ? 'true' : 'false',
          presetId: session.presetId,
        },
      }),
    (error) => setSaveError(error instanceof Error ? error.message : '保存失败，请重试。'),
  );
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const currentStep = getCurrentTrainingStep(elapsedSeconds, timeline);
  const phaseCopy = getPhaseCopy(currentStep.phase);
  const stepRemainingSeconds = getStepRemainingSeconds(elapsedSeconds, currentStep);
  const progress = totalSeconds === 0 ? 0 : Math.min(1, elapsedSeconds / totalSeconds);

  useEffect(() => {
    if (
      training.ready &&
      !training.error &&
      (elapsedSeconds >= totalSeconds || training.clock?.finished) &&
      !finishedRef.current
    ) {
      void finishSession();
    }
  });

  useEffect(() => {
    if (!isPaused) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [currentStep.phase, currentStep.repetition, isPaused]);

  async function finishSession() {
    finishedRef.current = true;
    training.setPaused(true);
    setSaveError(null);
    setIsSaving(true);
    try {
      await completion.current!.finish(() => {
        if (!training.clock || training.generation === undefined) throw new Error('训练尚未准备完成，请返回后重试。');
        authSessionContext.assertGeneration(training.generation);
        return { generation: training.generation, session: training.clock.finish() };
      });
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDiscardTraining() {
    if (isSaving) return;
    const wasPaused = isPaused;
    training.setPaused(true);

    Alert.alert('这组先撤？', '放弃后不会保存本次记录，小花当作没上班。', [
      {
        onPress: () => training.setPaused(wasPaused),
        style: 'cancel',
        text: '继续抬',
      },
      {
        onPress: () => {
          try {
            training.clear();
            router.replace(routes.training);
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : '放弃失败，请重试。');
          }
        },
        style: 'destructive',
        text: '放弃',
      },
    ]);
  }

  return (
    <Screen
      bottomSafeArea
      contentStyle={styles.screenContent}
      footer={
        <View style={styles.actions}>
          <AppButton
            disabled={!training.ready || isSaving || finishedRef.current}
            onPress={() => training.setPaused(!isPaused)}
            style={styles.actionButton}
            variant="secondary"
          >
            {!training.ready ? (training.error ? '未能开始' : '准备中…') : isPaused ? '继续' : '暂停'}
          </AppButton>
          <AppButton
            disabled={!training.ready || isSaving}
            onPress={() => {
              void finishSession();
            }}
            style={styles.actionButton}
            variant="warning"
          >
            {isSaving ? '保存中…' : saveError ? '重试保存' : '结束'}
          </AppButton>
        </View>
      }
    >
      <AppTopBar fallbackHref={routes.training} onBackPress={confirmDiscardTraining} title="菊花抬中" variant="close" />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>{preset.name}</Text>
          <Text style={styles.title}>
            第 {currentStep.repetition}/{preset.repetitions} 次
          </Text>
        </View>
        <View style={styles.phasePill}>
          <Text style={styles.phasePillText}>{currentStep.phase === 'contract' ? '收紧' : '放松'}</Text>
        </View>
      </View>

      <AppCard muted style={styles.timerCard}>
        <View style={styles.timerRing}>
          <View style={[styles.timerCore, currentStep.phase === 'relax' && styles.timerCoreRelax]}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.countdown}>
              {stepRemainingSeconds}
            </Text>
          </View>
        </View>

        <Text style={styles.phaseTitle}>{isPaused ? '已暂停' : phaseCopy.title}</Text>
        <Text style={styles.tipsText}>
          {training.clock?.recovered && isPaused
            ? '已恢复上次训练，请点击继续。'
            : '锁屏、来电或切到后台会自动暂停，返回后请手动继续。'}
        </Text>
        <Text style={styles.safetyHint}>{phaseCopy.safetyHint}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          已完成 {formatTrainingDuration(elapsedSeconds)} / {formatTrainingDuration(totalSeconds)}
        </Text>
      </AppCard>

      <AppCard style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>小花使用说明</Text>
        <Text style={styles.tipsText}>{trainingSafetyGuidance}</Text>
      </AppCard>

      {saveError || training.error ? (
        <AppCard muted>
          <Text accessibilityRole="alert" style={styles.safetyHint}>
            {saveError ?? training.error} 训练已暂停；可重试继续或保存。
          </Text>
        </AppCard>
      ) : null}
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screenContent: {
      gap: 16,
      paddingBottom: 16,
      paddingTop: 18,
    },
    topBar: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 8,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    phasePill: {
      backgroundColor: colors.primarySoft,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    phasePillText: {
      color: colors.primaryPressed,
      fontSize: 13,
      fontWeight: '800',
    },
    timerCard: {
      alignItems: 'center',
      borderRadius: 32,
      paddingVertical: 34,
    },
    timerRing: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 100,
      height: 200,
      justifyContent: 'center',
      marginBottom: 26,
      width: 200,
      maxWidth: '100%',
    },
    timerCore: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 76,
      borderWidth: 10,
      height: 152,
      justifyContent: 'center',
      width: 152,
      maxWidth: '100%',
      paddingHorizontal: 8,
    },
    timerCoreRelax: {
      borderColor: colors.info,
    },
    countdown: {
      color: colors.text,
      fontSize: 76,
      fontWeight: '800',
      letterSpacing: 0,
    },
    phaseTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
    },
    safetyHint: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      marginBottom: 26,
      textAlign: 'center',
    },
    progressTrack: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      height: 12,
      overflow: 'hidden',
      width: '86%',
    },
    progressFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: '100%',
    },
    progressText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 12,
    },
    tipsCard: {
      padding: 18,
    },
    tipsTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 8,
    },
    tipsText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
    },
  });
}
