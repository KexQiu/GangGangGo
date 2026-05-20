import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppSettingsState = {
  setToiletStageNotificationEnabled: (enabled: boolean) => void;
  setToiletStageSoundEnabled: (enabled: boolean) => void;
  setToiletLiveActivityEnabled: (enabled: boolean) => void;
  toiletLiveActivityEnabled: boolean;
  toiletStageNotificationEnabled: boolean;
  toiletStageSoundEnabled: boolean;
};

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      setToiletStageNotificationEnabled: (enabled) => set({ toiletStageNotificationEnabled: enabled }),
      setToiletStageSoundEnabled: (enabled) => set({ toiletStageSoundEnabled: enabled }),
      setToiletLiveActivityEnabled: (enabled) => set({ toiletLiveActivityEnabled: enabled }),
      toiletLiveActivityEnabled: false,
      toiletStageNotificationEnabled: true,
      toiletStageSoundEnabled: true,
    }),
    {
      name: 'gangganggo-app-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        toiletLiveActivityEnabled: state.toiletLiveActivityEnabled,
        toiletStageNotificationEnabled: state.toiletStageNotificationEnabled,
        toiletStageSoundEnabled: state.toiletStageSoundEnabled,
      }),
    },
  ),
);
