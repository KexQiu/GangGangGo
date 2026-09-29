import AsyncStorage from 'expo-sqlite/kv-store';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { authSessionContext } from '../../api/sessionContext';
import { defaultLocalProfileId } from '../../storage/localDataProfile';
import { useAuthStore } from '../account/authStore';
import { TrainingClock, parseTrainingCheckpoint } from './trainingClock';
import { startTrainingClockLifecycle } from './trainingClockLifecycle';

export function useTrainingClock(presetId: string | undefined) {
  const runtime = useRef<{ clock: TrainingClock; generation: number; key: string } | null>(null);
  const storageOwner = useRef<{ generation: number; key: string } | null>(null);
  const [view, setView] = useState({ elapsedSeconds: 0, isPaused: true, error: null as string | null });
  const [ready, setReady] = useState(false);
  const publish = useCallback((error: unknown = null) => {
    const clock = runtime.current?.clock;
    setView((state) => ({
      ...state,
      elapsedSeconds: clock?.elapsedSeconds ?? 0,
      isPaused: clock?.paused ?? true,
      error: error ? (error instanceof Error ? error.message : '训练进度保存失败，请重试。') : null,
    }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      try {
        if (!runtime.current) {
          const generation = authSessionContext.captureLocalGeneration();
          const profileId = authSessionContext.current()?.profileId ?? defaultLocalProfileId;
          const key = `xiaotidu-active-training:${profileId}`;
          storageOwner.current = { generation, key };
          const saved = parseTrainingCheckpoint(AsyncStorage.getItemSync(key));
          const clock = new TrainingClock(presetId, saved, (checkpoint) => {
            authSessionContext.assertGeneration(generation);
            if (storageOwner.current?.key !== key) return;
            AsyncStorage.setItemSync(key, JSON.stringify(checkpoint));
          });
          runtime.current = { clock, generation, key };
        }
        if (AppState.currentState !== 'active') runtime.current.clock.pause();
        setReady(true);
        publish();
      } catch (error) {
        publish(error);
      }

      function pause() {
        try {
          runtime.current?.clock.pause();
          publish();
        } catch (error) {
          publish(error);
        }
      }
      const stopClock = runtime.current ? startTrainingClockLifecycle(runtime.current.clock, publish) : undefined;
      const unsubscribeAuth = useAuthStore.subscribe(() => {
        if (runtime.current && !authSessionContext.isGenerationCurrent(runtime.current.generation)) pause();
      });
      return () => {
        stopClock?.();
        unsubscribeAuth();
      };
    }, [presetId, publish]),
  );

  function setPaused(paused: boolean) {
    try {
      const current = runtime.current;
      if (!current) return;
      authSessionContext.assertGeneration(current.generation);
      if (paused) current.clock.pause();
      else if (AppState.currentState === 'active') current.clock.resume();
      publish();
    } catch (error) {
      publish(error);
    }
  }

  function clear() {
    const owner = storageOwner.current;
    if (!owner) return;
    // 换号后只离开旧页面，保留旧资料的暂停快照，不删除新资料的进度。
    if (authSessionContext.isGenerationCurrent(owner.generation)) AsyncStorage.removeItemSync(owner.key);
    runtime.current = null;
    storageOwner.current = null;
  }

  return { ...view, ready, clock: runtime.current?.clock, generation: runtime.current?.generation, setPaused, clear };
}
