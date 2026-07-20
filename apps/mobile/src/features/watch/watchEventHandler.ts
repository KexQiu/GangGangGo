import { isProStatus } from '../account/accountModel';
import { getCachedCurrentUser, getCachedProStatus } from '../account/accountQueryService';
import { useAuthStore } from '../account/authStore';
import { getLocalDateKey } from '../habits/habitLogic';
import { useHabitStore } from '../habits/habitStore';
import { useAppSettingsStore } from '../settings/appSettingsStore';
import { endToiletLiveActivity, pauseToiletLiveActivity, resumeToiletLiveActivity } from '../toilet/toiletLiveActivity';
import { cancelToiletStageNotifications, syncToiletStageNotifications } from '../toilet/toiletStageNotificationService';
import { useToiletStore } from '../toilet/toiletStore';
import { getActiveToiletTimerElapsedSeconds, useToiletTimerSessionStore } from '../toilet/toiletTimerSessionStore';
import { useTrainingStore } from '../training/trainingStore';
import { type WatchEvent, type WatchEventAck } from './watchTypes';

const handledEventIds = new Set<string>();

export async function handleWatchEvent(event: WatchEvent): Promise<WatchEventAck> {
  const rejectionMessage = getProActionRejectionMessage();

  if (rejectionMessage) {
    return {
      eventId: event.id,
      message: rejectionMessage,
      status: 'rejected',
    };
  }

  if (handledEventIds.has(event.id)) {
    return {
      eventId: event.id,
      status: 'duplicate',
    };
  }

  try {
    switch (event.type) {
      case 'training_completed':
        await handleTrainingCompleted(event);
        break;
      case 'habit_toggled':
        await handleHabitToggled(event);
        break;
      case 'toilet_timer_action':
        await handleToiletTimerAction(event);
        break;
    }
  } catch (error) {
    return {
      eventId: event.id,
      message: error instanceof Error ? error.message : '手表事件处理失败。',
      status: 'rejected',
    };
  }

  handledEventIds.add(event.id);

  return {
    eventId: event.id,
    status: 'accepted',
  };
}

function getProActionRejectionMessage(): string | null {
  const auth = useAuthStore.getState();
  const user = getCachedCurrentUser();
  const proStatus = getCachedProStatus();

  if (!auth.accessToken || !user) {
    return '先在 iPhone 上登录小提督。';
  }

  if (isProStatus(proStatus)) {
    return null;
  }

  if (proStatus === 'pro_expired') {
    return '小提督 Pro 已暂停，请在 iPhone 上恢复后再使用手表联动。';
  }

  return 'Apple Watch 联动属于小提督 Pro。';
}

async function handleTrainingCompleted(event: Extract<WatchEvent, { type: 'training_completed' }>) {
  const endedAt = new Date(event.createdAt);
  const startedAt = new Date(endedAt.getTime() - event.payload.durationSeconds * 1000);

  await useTrainingStore.getState().addSession({
    completedRepetitions: event.payload.completedSets,
    discomfortReported: false,
    durationSeconds: event.payload.durationSeconds,
    endedAt: endedAt.toISOString(),
    id: `watch-${event.id}`,
    isCompleted: true,
    presetId: event.payload.mode,
    startedAt: startedAt.toISOString(),
  });
}

async function handleHabitToggled(event: Extract<WatchEvent, { type: 'habit_toggled' }>) {
  const date = getLocalDateKey(new Date(event.createdAt));
  const store = useHabitStore.getState();

  if (event.payload.level) {
    await store.setHabitLevel(date, event.payload.habitKey, event.payload.level);
    return;
  }

  await store.clearHabitLevel(date, event.payload.habitKey);
}

async function handleToiletTimerAction(event: Extract<WatchEvent, { type: 'toilet_timer_action' }>) {
  const sessionStore = useToiletTimerSessionStore.getState();
  const activeSession = sessionStore.session;

  if (!activeSession) {
    throw new Error('当前没有正在进行的蹲会儿。');
  }

  if (event.payload.action === 'pause') {
    sessionStore.pauseSession(event.payload.elapsedSeconds);
    await Promise.all([
      pauseToiletLiveActivity(activeSession.liveActivityId, event.payload.elapsedSeconds),
      cancelToiletStageNotifications(),
    ]);
    return;
  }

  if (event.payload.action === 'resume') {
    sessionStore.resumeSession();
    await resumeToiletLiveActivity(activeSession.liveActivityId, event.payload.elapsedSeconds);

    if (useAppSettingsStore.getState().toiletStageNotificationEnabled) {
      await syncToiletStageNotifications(event.payload.elapsedSeconds);
    }

    return;
  }

  const endedAt = new Date(event.createdAt);
  const durationSeconds = event.payload.elapsedSeconds || getActiveToiletTimerElapsedSeconds(activeSession, endedAt);

  await useToiletStore.getState().addSession({
    bleeding: false,
    discomfort: false,
    durationSeconds,
    endedAt: endedAt.toISOString(),
    feeling: 'normal',
    id: `watch-${event.id}`,
    startedAt: activeSession.startedAt,
  });
  await Promise.all([
    endToiletLiveActivity(activeSession.liveActivityId, durationSeconds),
    cancelToiletStageNotifications(),
  ]);
  sessionStore.clearSession();
}
