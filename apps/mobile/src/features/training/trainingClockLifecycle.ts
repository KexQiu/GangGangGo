import { AppState } from 'react-native';
import type { TrainingClock } from './trainingClock';

export function startTrainingClockLifecycle(clock: TrainingClock, publish: (error?: unknown) => void) {
  let boundary: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  function schedule() {
    clearTimeout(boundary);
    boundary = undefined;
    const delay = clock.nextBoundaryDelay;
    if (disposed || delay === null) return;
    boundary = setTimeout(() => {
      if (AppState.currentState !== 'active') {
        pause();
        return;
      }
      try {
        clock.sample();
        publish(null);
      } catch (error) {
        publish(error);
      }
      schedule();
    }, delay);
  }
  function pause() {
    clearTimeout(boundary);
    boundary = undefined;
    try {
      clock.pause();
      publish(null);
    } catch (error) {
      publish(error);
    }
  }
  if (AppState.currentState !== 'active') pause();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') pause();
  });
  // 仅刷新显示；阶段推进由单独的边界任务负责。恢复后重新装载边界。
  const display = setInterval(() => {
    if (AppState.currentState !== 'active') {
      if (!clock.paused) pause();
      return;
    }
    publish();
    if (!clock.paused && boundary === undefined) schedule();
  }, 100);
  function refresh() {
    clearTimeout(boundary);
    boundary = undefined;
    schedule();
  }
  schedule();
  return Object.assign(
    () => {
      disposed = true;
      clearTimeout(boundary);
      clearInterval(display);
      subscription.remove();
      pause();
    },
    { refresh },
  );
}
