import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { useAppSettingsStore } from '../../settings/appSettingsStore';
import { getToiletStageCopy, getToiletTimerStage } from '../toiletLogic';
import {
  endToiletLiveActivity,
  pauseToiletLiveActivity,
  resumeToiletLiveActivity,
  startToiletLiveActivity,
  syncToiletLiveActivity,
} from '../toiletLiveActivity';
import {
  getActiveToiletTimerElapsedSeconds,
  type ActiveToiletTimerSession,
  useToiletTimerSessionStore,
} from '../toiletTimerSessionStore';
import {
  cancelToiletStageNotifications,
  ensureToiletStageNotificationPermission,
  syncToiletStageNotifications,
} from '../toiletStageNotificationService';
import {
  playToiletStageSound,
  stopToiletStageSound,
  TOILET_STAGE_SOUND_SOURCES,
  type ToiletStageSoundPlayers,
} from '../toiletStageSoundService';

type CompletedTimer = {
  durationSeconds: number;
  startedAt: string;
};

type ToiletTimerScreenOptions = {
  onComplete: (timer: CompletedTimer) => void;
  onDiscard: () => void;
};

export function useToiletTimerScreen({ onComplete, onDiscard }: ToiletTimerScreenOptions) {
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
  const soundPlayers = useMemo<ToiletStageSoundPlayers>(
    () => ({
      gentle_warning: gentleWarningSoundPlayer,
      overtime: overtimeSoundPlayer,
      severe_warning: severeWarningSoundPlayer,
      strong_warning: strongWarningSoundPlayer,
    }),
    [gentleWarningSoundPlayer, overtimeSoundPlayer, severeWarningSoundPlayer, strongWarningSoundPlayer],
  );
  const lastStageRef = useRef(getToiletTimerStage(0));
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const activeSessionRef = useRef<string | null>(null);
  const sessionRef = useRef<ActiveToiletTimerSession | null>(session);
  const notificationsEnabledRef = useRef(toiletStageNotificationEnabled);
  const elapsedSeconds = getActiveToiletTimerElapsedSeconds(session);
  const isPaused = session?.isPaused ?? false;
  const stage = getToiletTimerStage(elapsedSeconds);
  const hasStarted = Boolean(session);

  sessionRef.current = session;
  notificationsEnabledRef.current = toiletStageNotificationEnabled;

  useEffect(() => () => stopToiletStageSound(soundPlayers), [soundPlayers]);

  useEffect(() => {
    if (!hasStarted || isPaused) return;
    const timer = setInterval(() => setTick((current) => current + 1), 1000);
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
        void syncToiletLiveActivity(currentSession.liveActivityId, currentElapsedSeconds, currentSession.isPaused);
        if (!currentSession.isPaused && notificationsEnabledRef.current) {
          void syncToiletStageNotifications(currentElapsedSeconds);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!toiletStageNotificationEnabled) void cancelToiletStageNotifications();
  }, [toiletStageNotificationEnabled]);

  useEffect(() => {
    if (activeSessionRef.current !== (session?.startedAt ?? null)) {
      activeSessionRef.current = session?.startedAt ?? null;
      lastStageRef.current = stage;
      return;
    }
    if (!hasStarted || lastStageRef.current === stage) return;

    lastStageRef.current = stage;
    const currentSession = sessionRef.current;
    void syncToiletLiveActivity(
      currentSession?.liveActivityId ?? null,
      getActiveToiletTimerElapsedSeconds(currentSession),
      currentSession?.isPaused ?? false,
    );
    if (appStateRef.current !== 'active') return;

    void Haptics.notificationAsync(
      stage === 'severe_warning' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning,
    );
    if (toiletStageSoundEnabled) void playToiletStageSound(stage, soundPlayers);
  }, [hasStarted, session?.startedAt, soundPlayers, stage, toiletStageSoundEnabled]);

  async function startTimer() {
    const startedAt = new Date().toISOString();
    startSession(startedAt);
    lastStageRef.current = getToiletTimerStage(0);
    void Haptics.selectionAsync();
    void cancelToiletStageNotifications();
    if (toiletStageNotificationEnabled) void ensureToiletStageNotificationPermission();
    if (!toiletLiveActivityEnabled) return;

    const activityId = await startToiletLiveActivity(startedAt, 0);
    const currentSession = useToiletTimerSessionStore.getState().session;
    if (currentSession?.startedAt === startedAt && activityId) {
      setLiveActivityId(activityId);
    } else if (activityId) {
      await endToiletLiveActivity(activityId, 0);
    }
  }

  function endTimer() {
    if (!session) return;
    stopToiletStageSound(soundPlayers);
    void cancelToiletStageNotifications();
    void endToiletLiveActivity(session.liveActivityId, elapsedSeconds);
    clearSession();
    onComplete({ durationSeconds: elapsedSeconds, startedAt: session.startedAt });
  }

  function discardTimer() {
    if (session) void endToiletLiveActivity(session.liveActivityId, elapsedSeconds);
    stopToiletStageSound(soundPlayers);
    void cancelToiletStageNotifications();
    clearSession();
    onDiscard();
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
      { onPress: discardTimer, style: 'destructive', text: '不记了' },
    ]);
  }

  function togglePause() {
    if (!session) return;
    const currentElapsedSeconds = elapsedSeconds;
    void Haptics.selectionAsync();
    if (session.isPaused) {
      resumeSession();
      void resumeToiletLiveActivity(session.liveActivityId, currentElapsedSeconds);
      return;
    }
    pauseSession(currentElapsedSeconds);
    void cancelToiletStageNotifications();
    void pauseToiletLiveActivity(session.liveActivityId, currentElapsedSeconds);
  }

  return {
    confirmDiscardTimer,
    elapsedSeconds,
    endTimer,
    hasStarted,
    isPaused,
    stage,
    stageCopy: getToiletStageCopy(stage),
    startTimer,
    togglePause,
  };
}
