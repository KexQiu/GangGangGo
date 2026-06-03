import { useAudioPlayer } from 'expo-audio';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Armchair, Pause, Play } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppTopBar } from '../../src/components/AppTopBar';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { useAppSettingsStore } from '../../src/features/settings/appSettingsStore';
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
  syncToiletLiveActivity,
} from '../../src/features/toilet/toiletLiveActivity';
import {
  getActiveToiletTimerElapsedSeconds,
  type ActiveToiletTimerSession,
  useToiletTimerSessionStore,
} from '../../src/features/toilet/toiletTimerSessionStore';
import {
  cancelToiletStageNotifications,
  ensureToiletStageNotificationPermission,
  syncToiletStageNotifications,
} from '../../src/features/toilet/toiletStageNotificationService';
import {
  playToiletStageSound,
  stopToiletStageSound,
  TOILET_STAGE_SOUND_SOURCES,
  type ToiletStageSoundPlayers,
} from '../../src/features/toilet/toiletStageSoundService';
import { type ToiletTimerStage } from '../../src/features/toilet/toiletTypes';
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
  const toiletStageNotificationEnabled = useAppSettingsStore((state) => state.toiletStageNotificationEnabled);
  const toiletStageSoundEnabled = useAppSettingsStore((state) => state.toiletStageSoundEnabled);
  const gentleWarningSoundPlayer = useAudioPlayer(TOILET_STAGE_SOUND_SOURCES.gentle_warning, {
    downloadFirst: true,
    keepAudioSessionActive: true,
    updateInterval: 80,
  });
  const strongWarningSoundPlayer = useAudioPlayer(TOILET_STAGE_SOUND_SOURCES.strong_warning, {
    downloadFirst: true,
    keepAudioSessionActive: true,
    updateInterval: 80,
  });
  const overtimeSoundPlayer = useAudioPlayer(TOILET_STAGE_SOUND_SOURCES.overtime, {
    downloadFirst: true,
    keepAudioSessionActive: true,
    updateInterval: 80,
  });
  const severeWarningSoundPlayer = useAudioPlayer(TOILET_STAGE_SOUND_SOURCES.severe_warning, {
    downloadFirst: true,
    keepAudioSessionActive: true,
    updateInterval: 80,
  });
  const toiletStageSoundPlayers = useMemo<ToiletStageSoundPlayers>(() => ({
    gentle_warning: gentleWarningSoundPlayer,
    overtime: overtimeSoundPlayer,
    severe_warning: severeWarningSoundPlayer,
    strong_warning: strongWarningSoundPlayer,
  }), [
    gentleWarningSoundPlayer,
    overtimeSoundPlayer,
    severeWarningSoundPlayer,
    strongWarningSoundPlayer,
  ]);
  const lastStageRef = useRef(getToiletTimerStage(0));
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const activeSessionRef = useRef<string | null>(null);
  const sessionRef = useRef<ActiveToiletTimerSession | null>(session);
  const toiletStageNotificationEnabledRef = useRef(toiletStageNotificationEnabled);
  const { colors } = useAppTheme();
  const elapsedSeconds = getActiveToiletTimerElapsedSeconds(session);
  const isPaused = session?.isPaused ?? false;
  const stage = getToiletTimerStage(elapsedSeconds);
  const stageCopy = getToiletStageCopy(stage);
  const styles = createStyles(colors, stage);
  const hasStarted = Boolean(session);

  sessionRef.current = session;
  toiletStageNotificationEnabledRef.current = toiletStageNotificationEnabled;

  useEffect(() => {
    return () => {
      stopToiletStageSound(toiletStageSoundPlayers);
    };
  }, [toiletStageSoundPlayers]);

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
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;

      const currentSession = sessionRef.current;
      if (nextState === 'active') {
        const currentElapsedSeconds = getActiveToiletTimerElapsedSeconds(currentSession);
        void syncToiletLiveActivity(
          currentSession?.liveActivityId ?? null,
          currentElapsedSeconds,
          currentSession?.isPaused ?? false,
        );
        void cancelToiletStageNotifications();
        lastStageRef.current = getToiletTimerStage(currentElapsedSeconds);
        setTick((current) => current + 1);
        return;
      }

      if (wasActive && currentSession) {
        const currentElapsedSeconds = getActiveToiletTimerElapsedSeconds(currentSession);
        void syncToiletLiveActivity(
          currentSession.liveActivityId,
          currentElapsedSeconds,
          currentSession.isPaused,
        );

        if (!currentSession.isPaused && toiletStageNotificationEnabledRef.current) {
          void syncToiletStageNotifications(currentElapsedSeconds);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!toiletStageNotificationEnabled) {
      void cancelToiletStageNotifications();
    }
  }, [toiletStageNotificationEnabled]);

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
    void syncToiletLiveActivity(session?.liveActivityId ?? null, elapsedSeconds, isPaused);

    if (appStateRef.current !== 'active') {
      return;
    }

    void Haptics.notificationAsync(
      stage === 'severe_warning'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning,
    );

    if (toiletStageSoundEnabled) {
      void playToiletStageSound(stage, toiletStageSoundPlayers);
    }
  }, [hasStarted, session?.startedAt, stage, toiletStageSoundEnabled, toiletStageSoundPlayers]);

  async function startTimer() {
    const startedAt = new Date().toISOString();
    startSession(startedAt);
    lastStageRef.current = getToiletTimerStage(0);
    void Haptics.selectionAsync();
    void cancelToiletStageNotifications();

    if (toiletStageNotificationEnabled) {
      void ensureToiletStageNotificationPermission();
    }

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
    stopToiletStageSound(toiletStageSoundPlayers);
    void cancelToiletStageNotifications();
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
    stopToiletStageSound(toiletStageSoundPlayers);
    void cancelToiletStageNotifications();
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
      void cancelToiletStageNotifications();
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
    void cancelToiletStageNotifications();
    void pauseToiletLiveActivity(activityId, currentElapsedSeconds);
  }

  if (!hasStarted) {
    return (
      <Screen>
        <AppTopBar fallbackHref={routes.home} title="蹲会儿" />

        <PageHeader
          eyebrow="蹲会儿"
          subtitle="开始后小花只负责计时和轻提醒。"
          title="蹲会儿"
        />

        <AppCard muted style={styles.startCard}>
          <View style={styles.startIcon}>
            <Armchair color={colors.info} size={38} strokeWidth={2.4} />
          </View>
          <Text style={styles.startTitle}>小花开始值班</Text>
          <Text style={styles.startText}>5 分钟看一眼，10 分钟准备收工，时间久了就先结束。</Text>
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
        <PageHeader eyebrow="蹲会儿" subtitle="小花值班中，办完就收工。" title="办正事中" />
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
        <Text style={styles.warningText}>{getStageHintText(stage)}</Text>
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

function getStageHintText(stage: ToiletTimerStage): string {
  switch (stage) {
    case 'gentle_warning':
      return '小花该下班了。如果已经办完，点收工就好。';
    case 'strong_warning':
      return '别再加班了。继续久蹲可能不舒服。';
    case 'overtime':
      return '小花过劳了。先结束，站起来活动一下。';
    case 'severe_warning':
      return '小花过劳了。请先结束，休息一下再说。';
    case 'normal':
    default:
      return '小花值班中。5 分钟后提醒你看一眼时间。';
  }
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

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
