import { trainingSafetyGuidance } from '../../src/features/safety/healthGuidance';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { authSessionContext } from '../../src/api/sessionContext';
import { useTrainingClock } from '../../src/features/training/useTrainingClock';
import { createTrainingCompletion } from '../../src/features/training/trainingCompletion';
import type { TrainingEndReason, TrainingFeedback } from '../../src/features/training/trainingTypes';
import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { Screen } from '../../src/components/Screen';
import { formatTrainingDuration } from '../../src/features/training/trainingLogic';
import { useTrainingStore } from '../../src/features/training/trainingStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function TrainingSessionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ presetId?: string }>();
  const training = useTrainingClock(params.presetId);
  const { isPaused, confirmPrompt } = training;
  const clock = training.clock;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigating = useRef(false);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const completion = useRef<ReturnType<typeof createTrainingCompletion> | null>(null);
  completion.current ??= createTrainingCompletion(
    async ({ session, generation }) => {
      await useTrainingStore.getState().addSession(session, { generation });
      authSessionContext.assertGeneration(generation);
      training.clear();
    },
    (session) => {
      navigating.current = true;
      if (pendingNavigation.current) pendingNavigation.current();
      else router.replace({ pathname: routes.trainingComplete, params: { id: session.id } });
    },
    (error) => setSaveError(error instanceof Error ? error.message : '保存失败，请重试。'),
  );

  async function save(feedback?: TrainingFeedback) {
    if (!clock?.draft || saving) return;
    setSaving(true);
    setSaveError(null);
    setAttempted(true);
    await completion.current!.finish(() => {
      if (training.generation === undefined) throw new Error('账号资料未就绪。');
      const session = feedback === undefined ? clock.draft! : clock.setFeedback(feedback);
      clock.lockSubmission();
      return { session, generation: training.generation };
    });
    setSaving(false);
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (
          navigating.current ||
          !training.clock?.draft ||
          training.generation === undefined ||
          !authSessionContext.isGenerationCurrent(training.generation)
        )
          return;
        event.preventDefault();
        pendingNavigation.current = () => navigation.dispatch(event.data.action);
        void saveRef.current();
      }),
    [navigation, training.clock, training.generation],
  );

  const phase = clock?.phase;
  const completed = clock?.completedRepetitions ?? 0;
  const promptRevision = clock?.promptRevision;
  useLayoutEffect(() => {
    if (isPaused || phase === 'ended' || phase === undefined) return;
    if (phase !== 'prepare')
      void (
        phase === 'contract' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()
      ).catch(() => undefined);
    confirmPrompt();
  }, [phase, promptRevision, isPaused, confirmPrompt]);

  function finish(reason: TrainingEndReason) {
    try {
      clock?.finish(reason);
      training.setPaused(true);
      training.publish();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '结束失败，请重试。');
    }
  }
  function close() {
    if (saving) return;
    if (training.generation !== undefined && !authSessionContext.isGenerationCurrent(training.generation)) {
      navigating.current = true;
      router.replace(routes.training);
      return;
    }
    if (clock?.draft) {
      void save();
      return;
    }
    const wasPaused = training.isPaused;
    training.setPaused(true);
    Alert.alert('结束这次练习？', '请先停止收缩，充分放松。可以保留已完成的记录。', [
      {
        text: '继续练习',
        style: 'cancel',
        onPress: () => {
          if (!wasPaused) training.setPaused(false);
        },
      },
      { text: '结束并记录', onPress: () => finish('user_stopped') },
      {
        text: '放弃记录',
        style: 'destructive',
        onPress: () => {
          try {
            training.clear();
            navigating.current = true;
            router.replace(routes.training);
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : '放弃失败，请重试。');
          }
        },
      },
    ]);
  }
  const title = clock?.draft
    ? '本次已结束，请放松'
    : training.isPaused
      ? '已暂停，请充分放松'
      : phase === 'prepare'
        ? '准备，正常呼吸'
        : phase === 'contract'
          ? '轻轻向上收缩'
          : '充分放松';
  return (
    <Screen bottomSafeArea>
      <AppTopBar fallbackHref={routes.training} onBackPress={close} title="菊花抬" variant="close" />
      <AppCard muted style={styles.timerCard}>
        <Text style={styles.title}>{clock?.preset.name ?? '准备中'}</Text>
        <Text style={styles.phaseTitle}>{title}</Text>
        {!clock?.draft && (
          <Text style={styles.countdown}>{training.isPaused ? '—' : clock?.remainingSeconds || '—'}</Text>
        )}
        <Text style={styles.progressText}>
          已完成 {completed}/{clock?.preset.repetitions ?? '—'} 次 · 有效用时{' '}
          {formatTrainingDuration(training.elapsedSeconds)}
        </Text>
        {clock && (
          <Text style={styles.tipsText}>
            收缩 {clock.preset.contractSeconds} 秒 · 放松 {clock.preset.relaxSeconds} 秒
          </Text>
        )}
        <Text style={styles.safetyHint}>
          {training.isPaused || clock?.draft ? '停止收缩，充分放松，正常呼吸。' : trainingSafetyGuidance}
        </Text>
        {clock?.interrupted && (
          <Text accessibilityRole="alert" style={styles.safetyHint}>
            节奏已中断，请先放松。本次未完整提示的动作不会补记。
          </Text>
        )}
        {clock?.stale && !clock.draft && (
          <Text style={styles.safetyHint}>这是之前日期的进度，请保存为未完成记录或放弃，不能继续训练。</Text>
        )}
        {!clock?.draft && <Text style={styles.tipsText}>暂停、锁屏或离开后不会自动继续。继续时先完整放松。</Text>}
      </AppCard>
      {clock?.draft ? (
        <AppCard style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>本次练习有没有不适？</Text>
          <Text style={styles.tipsText}>反馈不会改变已冻结的次数和时间。可以跳过，记录为“未反馈”。</Text>
          {clock.draft.feedback === 'reported' && (
            <Text style={styles.safetyHint}>已记录因不适停止。请停止练习；疼痛或症状加重时咨询专业人员。</Text>
          )}
          {!attempted && !clock.submissionLocked ? (
            <View style={{ gap: 10 }}>
              <AppButton onPress={() => void save('none')} variant="secondary">
                无不适，保存
              </AppButton>
              <AppButton onPress={() => void save('reported')} variant="warning">
                有不适，保存
              </AppButton>
              <AppButton onPress={() => void save()} variant="secondary">
                {clock.draft.feedback === 'reported' ? '保留不适反馈并保存' : '跳过并保存'}
              </AppButton>
            </View>
          ) : (
            <AppButton disabled={saving} onPress={() => void save()}>
              {saving ? '保存中…' : '重试保存'}
            </AppButton>
          )}
        </AppCard>
      ) : (
        <View style={{ gap: 12 }}>
          <AppButton
            disabled={!training.ready || clock?.stale}
            onPress={() => training.setPaused(!training.isPaused)}
            variant="secondary"
          >
            {training.isPaused ? '继续' : '暂停'}
          </AppButton>
          <AppButton disabled={!training.ready} onPress={() => finish(clock?.stale ? 'interrupted' : 'user_stopped')}>
            结束并记录
          </AppButton>
          <AppButton disabled={!training.ready} onPress={() => finish('discomfort')} variant="warning">
            因不适停止
          </AppButton>
        </View>
      )}
      {(saveError || training.error) && (
        <Text accessibilityRole="alert" style={styles.safetyHint}>
          {saveError ?? training.error}
        </Text>
      )}
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    timerCard: {
      alignItems: 'center',
      borderRadius: 32,
      paddingVertical: 34,
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
  });
}
