import type { ProStatus } from '@xiaotidu/contracts';

import type { HabitKey, HabitLevel } from '../habits/habitTypes';
import type { ToiletTimerStage } from '../toilet/toiletTypes';
import type { TrainingPresetId } from '../training/trainingTypes';

export type WatchTrainingModeConfig = {
  holdSeconds: number;
  id: TrainingPresetId;
  restSeconds: number;
  rounds: number;
};

export type WatchTodayState = {
  schemaVersion: 2;
  account: {
    isLoggedIn: boolean;
    nickname: null | string;
  };
  date: string;
  generatedAt: string;
  habits: {
    bowelDone: boolean;
    completion: 0 | 1 | 2 | 3 | 4;
    fiberDone: boolean;
    movementDone: boolean;
    waterDone: boolean;
  };
  pendingEventCount: number;
  proStatus: ProStatus;
  toilet: {
    elapsedSeconds: number;
    isPaused: boolean;
    isRunning: boolean;
    sessionCount: number;
    stage: null | ToiletTimerStage;
  };
  training: {
    completedSets: number;
    done: boolean;
  };
  trainingModes: WatchTrainingModeConfig[];
};

export type WatchEvent =
  | {
      createdAt: string;
      id: string;
      schemaVersion?: 2;
      payload: {
        completedSets: number;
        durationSeconds: number;
        mode: TrainingPresetId;
      };
      type: 'training_completed';
    }
  | {
      createdAt: string;
      id: string;
      schemaVersion?: 2;
      payload: {
        habitKey: HabitKey;
        level: HabitLevel | null;
      };
      type: 'habit_toggled';
    }
  | {
      createdAt: string;
      id: string;
      schemaVersion?: 2;
      payload: {
        action: 'finish' | 'pause' | 'resume';
        elapsedSeconds: number;
      };
      type: 'toilet_timer_action';
    };

export type WatchEventAck = {
  eventId: string;
  message?: string;
  state?: WatchTodayState;
  stateJson?: string;
  status: 'accepted' | 'duplicate' | 'rejected';
};

export type WatchConnectivityStatus = {
  isPaired: boolean;
  isReachable: boolean;
  isSupported: boolean;
  isWatchAppInstalled: boolean;
};

export type WatchConnectivityDebugInfo = WatchConnectivityStatus & {
  activationError?: string | null;
  activationState: string;
  embeddedWatchBundleIdentifiers: string[];
  iPhoneBundleIdentifier?: string | null;
  isSessionSupported: boolean;
};

export type WatchSyncResult = {
  reason?: string;
  sent: boolean;
};
