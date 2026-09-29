import { authSessionContext, SessionChangedError } from '../../api/sessionContext';
import {
  commitLocalMutation,
  hasWatchReceipt,
  PermanentMutationError,
  type LocalMutationOptions,
} from '../../storage/localMutation';
import { getCachedCurrentUser, getCachedFeatureAccess, getCachedEntitlements } from '../account/accountQueryService';
import { useAuthStore } from '../account/authStore';
import { getLocalDateKey } from '../habits/habitLogic';
import { useHabitStore } from '../habits/habitStore';
import { useAppSettingsStore } from '../settings/appSettingsStore';
import { endToiletLiveActivity, pauseToiletLiveActivity, resumeToiletLiveActivity } from '../toilet/toiletLiveActivity';
import { cancelToiletStageNotifications, syncToiletStageNotifications } from '../toilet/toiletStageNotificationService';
import { useToiletStore } from '../toilet/toiletStore';
import { persistWatchTimerAction, useToiletTimerSessionStore } from '../toilet/toiletTimerSessionStore';
import { isToiletTimerCompleted } from '../toilet/toiletDraftService';
import { useTrainingStore } from '../training/trainingStore';
import { type WatchEvent, type WatchEventAck, type WatchEventOwner } from './watchTypes';
import { trackGrowthEvent } from '../growth/growthEventTracker';

export async function handleWatchEvent(event: WatchEvent): Promise<WatchEventAck> {
  const ack = (status: WatchEventAck['status'], message?: string): WatchEventAck => ({
    eventId: event.id,
    status,
    ...(message ? { message } : {}),
  });
  const owner = authSessionContext.current();
  if (!owner) {
    const auth = useAuthStore.getState();
    return ack(!auth.hasHydrated || auth.isLoading ? 'retryable' : 'rejected', '先在 iPhone 上登录原账号。');
  }
  if (event.owner.userId !== owner.userId || event.owner.profileId !== owner.profileId)
    return ack('rejected', '账号已变更，这条旧操作未写入当前账号。');
  const age = Date.now() - Date.parse(event.createdAt);
  if (age > 24 * 60 * 60 * 1000 || age < -5 * 60 * 1000) return ack('rejected', '手表操作已过期或设备时间不正确。');
  const options: LocalMutationOptions = {
    generation: owner.generation,
    profileId: owner.profileId,
    assertCurrent: () => authSessionContext.assertCurrent(owner),
    receipt: { eventId: event.id, eventJson: JSON.stringify(event) },
  };
  try {
    if (await hasWatchReceipt(options)) {
      if (event.type === 'toilet_timer_action' && event.payload.action === 'finish') {
        await finishPersistedTimer(event.payload.sessionId, event.payload.elapsedSeconds, event.owner);
      }
      return ack('duplicate');
    }
    if (getCachedCurrentUser()?.id !== owner.userId || !getCachedEntitlements())
      return ack('retryable', '手机正在恢复账号状态，稍后重试。');
    if (!getCachedFeatureAccess('watchActions'))
      return ack(
        event.type === 'training_finished' ? 'retryable' : 'rejected',
        '当前账号暂不能使用 Apple Watch 操作，请恢复权限后重试。',
      );
    const result =
      event.type === 'training_finished'
        ? await handleTrainingCompleted(event, options)
        : event.type === 'habit_toggled'
          ? await handleHabitToggled(event, options)
          : await handleToiletTimerAction(event, options);
    if (result.status === 'duplicate') return ack('duplicate');
    // 统计和设备展示失败不能把已提交的记录报告成未保存。
    try {
      trackGrowthEvent('watch_action_completed', {
        action: event.type === 'training_finished' ? 'training' : event.type === 'habit_toggled' ? 'habit' : 'toilet',
        domain: 'watch',
        source: 'watch',
      });
    } catch {
      /* 下一次同步继续刷新展示。 */
    }
    return ack('accepted');
  } catch (error) {
    return ack(
      error instanceof SessionChangedError || error instanceof PermanentMutationError ? 'rejected' : 'retryable',
      error instanceof Error ? error.message : '保存失败，手表会保留并重试。',
    );
  }
}

async function handleTrainingCompleted(
  event: Extract<WatchEvent, { type: 'training_finished' }>,
  options: LocalMutationOptions,
) {
  return useTrainingStore.getState().addSession(event.payload.session, options);
}

async function handleHabitToggled(
  event: Extract<WatchEvent, { type: 'habit_toggled' }>,
  options: LocalMutationOptions,
) {
  const date = getLocalDateKey(new Date(event.createdAt));
  const store = useHabitStore.getState();

  if (event.payload.level) {
    return store.setHabitLevel(date, event.payload.habitKey, event.payload.level, options);
  }

  return store.clearHabitLevel(date, event.payload.habitKey, options);
}

async function handleToiletTimerAction(
  event: Extract<WatchEvent, { type: 'toilet_timer_action' }>,
  options: LocalMutationOptions,
) {
  const sessionStore = useToiletTimerSessionStore.getState();
  const activeSession = sessionStore.session;

  if (await isToiletTimerCompleted(event.payload.sessionId))
    throw new PermanentMutationError('这次计时已结束，请在手机查看记录或待补充草稿。');

  if (
    !activeSession ||
    activeSession.id !== event.payload.sessionId ||
    activeSession.owner?.userId !== event.owner.userId ||
    activeSession.owner?.profileId !== event.owner.profileId
  ) {
    throw new PermanentMutationError('这次计时已结束或已变更，旧操作未执行。');
  }

  if (event.payload.action !== 'finish') {
    const result = await commitLocalMutation(options, async () => {
      if (useToiletTimerSessionStore.getState().session?.id !== activeSession.id)
        throw new PermanentMutationError('计时已变更。');
      await persistWatchTimerAction(activeSession.id, event.payload.action, event.payload.elapsedSeconds);
    });
    // 原生展示不占用健康记录事务，也不能撤销已经提交的回执。
    if (result.status === 'saved' && useToiletTimerSessionStore.getState().session?.id === activeSession.id) {
      await Promise.allSettled(
        event.payload.action === 'pause'
          ? [
              pauseToiletLiveActivity(activeSession.liveActivityId, event.payload.elapsedSeconds),
              cancelToiletStageNotifications(),
            ]
          : [
              resumeToiletLiveActivity(activeSession.liveActivityId, event.payload.elapsedSeconds),
              ...(useAppSettingsStore.getState().toiletStageNotificationEnabled
                ? [syncToiletStageNotifications(event.payload.elapsedSeconds)]
                : []),
            ],
      );
    }
    return result;
  }

  const endedAt = new Date(event.createdAt);
  const durationSeconds = event.payload.elapsedSeconds;
  if (endedAt.getTime() < Date.parse(activeSession.startedAt))
    throw new PermanentMutationError('结束时间早于计时开始时间。');

  const result = await useToiletStore.getState().addSession(
    {
      bleeding: false,
      discomfort: false,
      durationSeconds,
      endedAt: endedAt.toISOString(),
      feeling: 'normal',
      id: `watch-${event.id}`,
      startedAt: activeSession.startedAt,
    },
    {
      ...options,
      completedTimerId: activeSession.id,
      assertMutationTarget: () => {
        if (useToiletTimerSessionStore.getState().session?.id !== activeSession.id)
          throw new PermanentMutationError('计时已变更。');
      },
    },
  );
  await finishPersistedTimer(activeSession.id, durationSeconds, event.owner);
  return result;
}

async function finishPersistedTimer(sessionId: string, durationSeconds: number, owner: WatchEventOwner) {
  const session = useToiletTimerSessionStore.getState().session;
  if (
    session?.id !== sessionId ||
    session.owner?.userId !== owner.userId ||
    session.owner?.profileId !== owner.profileId
  )
    return;
  await persistWatchTimerAction(sessionId, 'finish', durationSeconds);
  await Promise.allSettled([
    endToiletLiveActivity(session.liveActivityId, durationSeconds),
    ...(useToiletTimerSessionStore.getState().session ? [] : [cancelToiletStageNotifications()]),
  ]);
}
