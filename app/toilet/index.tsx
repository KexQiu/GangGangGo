import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { useAppSettingsStore } from '../../src/features/settings/appSettingsStore';
import { SquatIcon } from '../../src/features/toilet/SquatIcon';
import {
  formatToiletDuration,
  getToiletStageCopy,
  getToiletTimerStage,
} from '../../src/features/toilet/toiletLogic';
import {
  endToiletLiveActivity,
  pauseToiletLiveActivity,
  resumeToiletLiveActivity,
  startToiletLiveActivity,
} from '../../src/features/toilet/toiletLiveActivity';
import {
  getActiveToiletTimerElapsedSeconds,
  useToiletTimerSessionStore,
} from '../../src/features/toilet/toiletTimerSessionStore';
import { routes } from '../../src/navigation/routes';
import { useAppTheme } from '../../src/theme/themeProvider';

export default function ToiletScreen() {
  const router = useRouter();
  const [, setTick] = useState(0);
  const session = useToiletTimerSessionStore((state) => state.session);
  const startSession = useToiletTimerSessionStore((state) => state.startSession);
  const pauseSession = useToiletTimerSessionStore((state) => state.pauseSession);
  const resumeSession = useToiletTimerSessionStore((state) => state.resumeSession);
  const clearSession = useToiletTimerSessionStore((state) => state.clearSession);
  const setLiveActivityId = useToiletTimerSessionStore((state) => state.setLiveActivityId);
  const toiletLiveActivityEnabled = useAppSettingsStore((state) => state.toiletLiveActivityEnabled);
  const lastStageRef = useRef(getToiletTimerStage(0));
  const activeSessionRef = useRef<string | null>(null);
  const { colors } = useAppTheme();
  const elapsedSeconds = getActiveToiletTimerElapsedSeconds(session);
  const isPaused = session?.isPaused ?? false;
  const stage = getToiletTimerStage(elapsedSeconds);
  const stageCopy = getToiletStageCopy(stage);
  const styles = createStyles(colors, stage);
  const hasStarted = Boolean(session);

  useEffect(() => {
    if (!hasStarted || isPaused) {
      return;
    }

    const timer = setInterval(() => {
      setTick((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, isPaused]);

  useEffect(() => {
    if (activeSessionRef.current !== (session?.startedAt ?? null)) {
      activeSessionRef.current = session?.startedAt ?? null;
      lastStageRef.current = stage;
      return;
    }

    if (!hasStarted || lastStageRef.current === stage) {
      return;
    }

    lastStageRef.current = stage;
    void Haptics.notificationAsync(
      stage === 'severe_warning'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning,
    );
  }, [hasStarted, session?.startedAt, stage]);

  async function startTimer() {
    const startedAt = new Date().toISOString();
    startSession(startedAt);
    lastStageRef.current = getToiletTimerStage(0);
    void Haptics.selectionAsync();

    if (!toiletLiveActivityEnabled) {
      return;
    }

    const activityId = await startToiletLiveActivity(startedAt, 0);
    const currentSession = useToiletTimerSessionStore.getState().session;
    if (currentSession?.startedAt === startedAt && activityId) {
      setLiveActivityId(activityId);
      return;
    }

    if (activityId) {
      await endToiletLiveActivity(activityId, 0);
    }
  }

  function endTimer() {
    if (!session) {
      return;
    }

    const durationSeconds = elapsedSeconds;
    const startedAt = session.startedAt;
    void endToiletLiveActivity(session.liveActivityId, durationSeconds);
    clearSession();

    router.push({
      pathname: routes.toiletComplete,
      params: {
        durationSeconds: durationSeconds.toString(),
        startedAt,
      },
    });
  }

  function discardTimer() {
    if (session) {
      void endToiletLiveActivity(session.liveActivityId, elapsedSeconds);
    }
    clearSession();
    router.replace(routes.home);
  }

  function confirmDiscardTimer() {
    const wasPaused = session?.isPaused ?? false;
    const activityId = session?.liveActivityId ?? null;
    const pausedElapsedSeconds = elapsedSeconds;

    if (!wasPaused) {
      pauseSession(pausedElapsedSeconds);
      void pauseToiletLiveActivity(activityId, pausedElapsedSeconds);
    }

    Alert.alert('这次不记了？', '放弃后不会保存本次记录，就当小本本没翻开。', [
      {
        onPress: () => {
          if (!wasPaused) {
            resumeSession();
            void resumeToiletLiveActivity(activityId, pausedElapsedSeconds);
          }
        },
        style: 'cancel',
        text: '继续营业',
      },
      {
        onPress: discardTimer,
        style: 'destructive',
        text: '不记了',
      },
    ]);
  }

  function togglePause() {
    if (!session) {
      return;
    }

    const activityId = session.liveActivityId;
    const currentElapsedSeconds = elapsedSeconds;
    void Haptics.selectionAsync();

    if (session.isPaused) {
      resumeSession();
      void resumeToiletLiveActivity(activityId, currentElapsedSeconds);
      return;
    }

    pauseSession(currentElapsedSeconds);
    void pauseToiletLiveActivity(activityId, currentElapsedSeconds);
  }

  if (!hasStarted) {
    return (
      <Screen>
        <AppTopBar fallbackHref={routes.home} title="蹲会儿" />

        <PageHeader
          eyebrow="蹲会儿"
          subtitle="开始后只留计时，不刷信息流，不开小剧场。"
          title="蹲会儿"
        />

        <AppCard muted style={styles.startCard}>
          <View style={styles.startIcon}>
            <SquatIcon color={colors.info} size={38} />
          </View>
          <Text style={styles.startTitle}>开始前先把手机小剧场关一关</Text>
          <Text style={styles.startText}>5 分钟轻敲门，10 分钟催收工，20 分钟认真请你收工。</Text>
        </AppCard>

        <AppButton onPress={startTimer}>开始计时</AppButton>
      </Screen>
    );
  }

  return (
    <Screen bottomSafeArea scroll={false} contentStyle={styles.screenContent}>
      <AppTopBar
        fallbackHref={routes.home}
        onBackPress={confirmDiscardTimer}
        title="办正事中"
        variant="close"
      />

      <View>
        <PageHeader eyebrow="蹲会儿" subtitle="专心办正事，结束就收工。" title="办正事中" />
      </View>

      <AppCard style={styles.timerCard}>
        <View style={styles.timerRing}>
          <Text style={styles.timerText}>{formatToiletDuration(elapsedSeconds)}</Text>
        </View>
        <Text style={styles.stageTitle}>{stageCopy.title}</Text>
        <Text style={styles.stageDescription}>{stageCopy.description}</Text>
      </AppCard>

      <AppCard style={styles.warningCard}>
        <Text style={styles.warningTitle}>阶段提示</Text>
        <Text style={styles.warningText}>
          {stage === 'normal'
            ? '5 分钟后会轻轻提醒：正事办完就撤。'
            : stage === 'severe_warning'
              ? '已经超过 20 分钟，建议先收工，给小花一点下班时间。'
              : '办完就点收工，给小账本留个线索。'}
        </Text>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={endTimer} style={styles.actionButton}>
          收工
        </AppButton>
        <AppButton
          onPress={togglePause}
          style={styles.actionButton}
          variant="secondary"
        >
          {isPaused ? '继续' : '暂停'}
        </AppButton>
      </View>

      <View style={styles.pauseIndicator}>
        {isPaused ? <Play color={colors.textSubtle} size={16} /> : <Pause color={colors.textSubtle} size={16} />}
      </View>
    </Screen>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
type ToiletTimerStage = ReturnType<typeof getToiletTimerStage>;

function createStyles(colors: ThemeColors, stage: ToiletTimerStage) {
  const accentColor = stage === 'normal'
    ? colors.primary
    : stage === 'gentle_warning'
      ? colors.info
      : stage === 'severe_warning'
        ? colors.danger
        : colors.warning;
  const accentSoft = stage === 'normal'
    ? colors.primarySoft
    : stage === 'gentle_warning'
      ? colors.infoSoft
      : stage === 'severe_warning'
        ? colors.dangerSoft
        : colors.warningSoft;

  return StyleSheet.create({
    startCard: {
      alignItems: 'center',
      marginBottom: 18,
      paddingVertical: 34,
    },
    startIcon: {
      alignItems: 'center',
      backgroundColor: colors.infoSoft,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: 20,
      width: 72,
    },
    startTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 10,
    },
    startText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 22,
      textAlign: 'center',
    },
    screenContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingBottom: 24,
      paddingHorizontal: 24,
      paddingTop: 18,
    },
    timerCard: {
      alignItems: 'center',
      borderRadius: 32,
      paddingVertical: 38,
    },
    timerRing: {
      alignItems: 'center',
      backgroundColor: accentSoft,
      borderColor: accentColor,
      borderRadius: 96,
      borderWidth: 8,
      height: 192,
      justifyContent: 'center',
      marginBottom: 26,
      width: 192,
    },
    timerText: {
      color: colors.text,
      fontSize: 54,
      fontWeight: '800',
      letterSpacing: 0,
    },
    stageTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    stageDescription: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21,
      textAlign: 'center',
    },
    warningCard: {
      backgroundColor: accentSoft,
      borderColor: accentColor,
      padding: 18,
    },
    warningTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 8,
    },
    warningText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 5,
    },
    pauseIndicator: {
      alignItems: 'center',
      height: 18,
      justifyContent: 'center',
      opacity: 0,
    },
  });
}
