import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { Screen } from '../../src/components/Screen';
import { getTrainingPreset } from '../../src/features/training/presets';
import {
  buildTrainingTimeline,
  formatTrainingDuration,
  getCompletedRepetitions,
  getCurrentTrainingStep,
  getPhaseCopy,
  getStepRemainingSeconds,
  getTimelineTotalSeconds,
} from '../../src/features/training/trainingLogic';
import { useTrainingStore } from '../../src/features/training/trainingStore';
import { type TrainingSession } from '../../src/features/training/trainingTypes';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ presetId?: string }>();
  const addSession = useTrainingStore((state) => state.addSession);
  const preset = getTrainingPreset(params.presetId);
  const timeline = useMemo(() => buildTrainingTimeline(preset), [preset]);
  const totalSeconds = getTimelineTotalSeconds(timeline);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const finishedRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const currentStep = getCurrentTrainingStep(elapsedSeconds, timeline);
  const phaseCopy = getPhaseCopy(currentStep.phase);
  const stepRemainingSeconds = getStepRemainingSeconds(elapsedSeconds, currentStep);
  const completedRepetitions = getCompletedRepetitions(elapsedSeconds, timeline);
  const progress = totalSeconds === 0 ? 0 : Math.min(1, elapsedSeconds / totalSeconds);

  useEffect(() => {
    if (isPaused || finishedRef.current) {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((current) => Math.min(current + 1, totalSeconds));
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, totalSeconds]);

  useEffect(() => {
    if (elapsedSeconds >= totalSeconds && !finishedRef.current) {
      finishSession(true);
    }
  });

  useEffect(() => {
    if (!isPaused) {
      void Haptics.selectionAsync();
    }
  }, [currentStep.phase, currentStep.repetition, isPaused]);

  function finishSession(isCompleted: boolean) {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    const endedAt = new Date().toISOString();
    const session: TrainingSession = {
      id: createSessionId(),
      presetId: preset.id,
      startedAt: startedAtRef.current,
      endedAt,
      durationSeconds: elapsedSeconds,
      completedRepetitions: isCompleted ? preset.repetitions : completedRepetitions,
      isCompleted,
      discomfortReported: false,
    };

    addSession(session);
    router.replace({
      pathname: routes.trainingComplete,
      params: {
        completedRepetitions: session.completedRepetitions.toString(),
        durationSeconds: session.durationSeconds.toString(),
        isCompleted: session.isCompleted ? 'true' : 'false',
        presetId: session.presetId,
      },
    });
  }

  function confirmDiscardTraining() {
    const wasPaused = isPaused;
    setIsPaused(true);

    Alert.alert('这组先撤？', '放弃后不会保存本次记录，小花当作没上班。', [
      {
        onPress: () => setIsPaused(wasPaused),
        style: 'cancel',
        text: '继续抬',
      },
      {
        onPress: () => router.replace(routes.training),
        style: 'destructive',
        text: '放弃',
      },
    ]);
  }

  return (
    <Screen bottomSafeArea scroll={false} contentStyle={styles.screenContent}>
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
            <Text style={styles.countdown}>{stepRemainingSeconds}</Text>
          </View>
        </View>

        <Text style={styles.phaseTitle}>{phaseCopy.title}</Text>
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
        <Text style={styles.tipsText}>这是提肛训练：轻提轻放，呼吸在线。别夹臀、别收腹，疼了或更不舒服就停。</Text>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={() => setIsPaused((current) => !current)} style={styles.actionButton} variant="secondary">
          {isPaused ? '继续' : '暂停'}
        </AppButton>
        <AppButton onPress={() => finishSession(false)} style={styles.actionButton} variant="warning">
          结束
        </AppButton>
      </View>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screenContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingBottom: 24,
      paddingHorizontal: 24,
      paddingTop: 18,
    },
    topBar: {
      alignItems: 'flex-start',
      flexDirection: 'row',
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
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
  });
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
