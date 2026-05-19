import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppSettingsState = {
  setToiletLiveActivityEnabled: (enabled: boolean) => void;
  toiletLiveActivityEnabled: boolean;
};

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      setToiletLiveActivityEnabled: (enabled) => set({ toiletLiveActivityEnabled: enabled }),
      toiletLiveActivityEnabled: false,
    }),
    {
      name: 'gangganggo-app-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        toiletLiveActivityEnabled: state.toiletLiveActivityEnabled,
      }),
    },
  ),
);
