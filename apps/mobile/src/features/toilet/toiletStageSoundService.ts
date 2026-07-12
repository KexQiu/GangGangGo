import { setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';

import { type ToiletTimerStage } from './toiletTypes';

type ToiletStageSound = Exclude<ToiletTimerStage, 'normal'>;

export type ToiletStageSoundPlayers = Partial<Record<ToiletTimerStage, AudioPlayer>>;

export const TOILET_STAGE_SOUND_SOURCES: Record<ToiletStageSound, number> = {
  gentle_warning: require('../../../assets/sounds/toilet-knock-5.wav') as number,
  overtime: require('../../../assets/sounds/toilet-warning-15.wav') as number,
  severe_warning: require('../../../assets/sounds/toilet-stop-20.wav') as number,
  strong_warning: require('../../../assets/sounds/toilet-chime-10.wav') as number,
};

const soundDurations: Partial<Record<ToiletTimerStage, number>> = {
  gentle_warning: 900,
  overtime: 950,
  severe_warning: 1150,
  strong_warning: 700,
};

let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
let playTimer: ReturnType<typeof setTimeout> | null = null;

export async function configureToiletStageAudio(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: 'mixWithOthers',
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
  await setIsAudioActiveAsync(true);
}

export async function playToiletStageSound(stage: ToiletTimerStage, players: ToiletStageSoundPlayers): Promise<void> {
  const player = players[stage];

  if (!player) {
    return;
  }

  stopToiletStageSound(players);

  try {
    await configureToiletStageAudio();
    player.volume = stage === 'severe_warning' ? 1 : stage === 'overtime' ? 0.9 : 0.82;
    await seekToStart(player);
    playPlayer(player);

    playTimer = setTimeout(() => {
      if (!player.playing) {
        void seekToStart(player).then(() => {
          playPlayer(player);
        });
      }
    }, 180);

    cleanupTimer = setTimeout(
      () => {
        stopToiletStageSound(players);
      },
      (soundDurations[stage] ?? 900) + 300,
    );
  } catch {
    stopToiletStageSound(players);
  }
}

export function stopToiletStageSound(players?: ToiletStageSoundPlayers): void {
  if (playTimer) {
    clearTimeout(playTimer);
    playTimer = null;
  }

  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  if (players) {
    for (const player of Object.values(players)) {
      if (!player) {
        continue;
      }

      pausePlayer(player);
      void seekToStart(player);
    }
  }
}

async function seekToStart(player: AudioPlayer): Promise<void> {
  try {
    await player.seekTo(0);
  } catch {
    // The player can still be loading when the page mounts or unmounts.
  }
}

function pausePlayer(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {
    // Ignore transient native player lifecycle errors.
  }
}

function playPlayer(player: AudioPlayer): void {
  try {
    player.play();
  } catch {
    // Ignore transient native player lifecycle errors.
  }
}
