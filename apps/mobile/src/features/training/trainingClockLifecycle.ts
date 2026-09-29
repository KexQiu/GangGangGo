import { AppState } from 'react-native';
import type { TrainingClock } from './trainingClock';

export function startTrainingClockLifecycle(clock: TrainingClock, publish: (error?: unknown) => void) {
  function pause() {
    try {
      clock.pause();
      publish();
    } catch (error) {
      publish(error);
    }
  }
  if (AppState.currentState !== 'active') pause();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') pause();
    // 回到前台保持暂停，必须手动继续。
  });
  const timer = setInterval(() => {
    if (clock.paused) return;
    try {
      if (AppState.currentState !== 'active') clock.pause();
      else clock.sample();
      publish();
    } catch (error) {
      publish(error);
    }
  }, 1000);
  return () => {
    clearInterval(timer);
    subscription.remove();
    pause();
  };
}
