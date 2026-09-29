import { loadTrainingCheckpoint } from './trainingCheckpointMigration';
import AsyncStorage from 'expo-sqlite/kv-store';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { authSessionContext } from '../../api/sessionContext';
import { defaultLocalProfileId } from '../../storage/localDataProfile';
import { useAuthStore } from '../account/authStore';
import { TrainingClock } from './trainingClock';
import { startTrainingClockLifecycle } from './trainingClockLifecycle';
import { getTrainingPreset } from './presets';
import { useTrainingPreferencesStore } from './trainingPreferencesStore';

export function useTrainingClock(presetId: string | undefined) {
  const runtime = useRef<{ clock: TrainingClock; generation: number; key: string } | null>(null);
  const lifecycle = useRef<ReturnType<typeof startTrainingClockLifecycle> | null>(null);
  const [, redraw] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const publish = useCallback((error?: unknown) => {
    if (error !== undefined)
      setError(error ? (error instanceof Error ? error.message : '训练进度保存失败，请重试。') : null);
    redraw((value) => value + 1);
  }, []);
  useFocusEffect(
    useCallback(() => {
      let disposed = false;
      const generation = authSessionContext.getGeneration();
      void (async () => {
        try {
          if (!runtime.current) {
            await useTrainingPreferencesStore.getState().hydrate();
            if (disposed) return;
            authSessionContext.assertGeneration(generation);
            const preferences = useTrainingPreferencesStore.getState();
            if (!preferences.hasHydrated) throw new Error(preferences.error ?? '训练设置尚未读取。');
            const profileId = authSessionContext.current()?.profileId ?? defaultLocalProfileId;
            const key = `xiaotidu-active-training-v2:${profileId}`;
            const oldKey = `xiaotidu-active-training:${profileId}`;
            const saved = loadTrainingCheckpoint(AsyncStorage, key, oldKey);
            const base = getTrainingPreset(presetId);
            const clock = new TrainingClock(
              { ...base, ...preferences.preferences.presets[base.id] },
              saved,
              (checkpoint) => {
                authSessionContext.assertGeneration(generation);
                AsyncStorage.setItemSync(key, JSON.stringify(checkpoint));
              },
            );
            runtime.current = { clock, generation, key };
          }
          if (AppState.currentState !== 'active') runtime.current.clock.pause();
          lifecycle.current = startTrainingClockLifecycle(runtime.current.clock, publish);
          setReady(true);
          publish(null);
        } catch (error) {
          if (!disposed) publish(error);
        }
      })();
      const unsubscribe = useAuthStore.subscribe(() => {
        if (runtime.current && !authSessionContext.isGenerationCurrent(runtime.current.generation)) {
          lifecycle.current?.();
          lifecycle.current = null;
          setReady(false);
          publish(new Error('账号已切换，请返回后继续。'));
        }
      });
      return () => {
        disposed = true;
        lifecycle.current?.();
        lifecycle.current = null;
        unsubscribe();
      };
    }, [presetId, publish]),
  );
  const confirmPrompt = useCallback(() => {
    const current = runtime.current;
    if (!current) return;
    try {
      authSessionContext.assertGeneration(current.generation);
      if (AppState.currentState !== 'active') current.clock.pause();
      else current.clock.confirmPrompt();
      lifecycle.current?.refresh();
      publish(null);
    } catch (error) {
      publish(error);
    }
  }, [publish]);
  function setPaused(paused: boolean) {
    try {
      const current = runtime.current;
      if (!current) return;
      authSessionContext.assertGeneration(current.generation);
      if (paused) current.clock.pause();
      else if (AppState.currentState === 'active') current.clock.resume();
      lifecycle.current?.refresh();
      publish(null);
    } catch (error) {
      publish(error);
    }
  }
  function clear() {
    const current = runtime.current;
    if (!current) return;
    authSessionContext.assertGeneration(current.generation);
    // 停止运行后才移除，避免 cleanup 再写回已保存的检查点。
    lifecycle.current?.();
    lifecycle.current = null;
    AsyncStorage.removeItemSync(current.key);
    runtime.current = null;
  }
  const clock = runtime.current?.clock;
  return {
    ready,
    error,
    clock,
    generation: runtime.current?.generation,
    elapsedSeconds: clock?.elapsedSeconds ?? 0,
    isPaused: clock?.paused ?? true,
    setPaused,
    confirmPrompt,
    clear,
    publish,
  };
}
