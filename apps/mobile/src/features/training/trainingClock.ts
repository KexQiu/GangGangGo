import { getTrainingPreset, isTrainingPresetId } from './presets';
import { buildTrainingTimeline, getCompletedRepetitions, getTimelineTotalSeconds } from './trainingLogic';
import type { TrainingPresetId, TrainingSession } from './trainingTypes';

export type TrainingCheckpoint = {
  id: string;
  presetId: TrainingPresetId;
  startedAt: string;
  elapsedMs: number;
  endedAt: string | null;
};

export function parseTrainingCheckpoint(value: string | null): TrainingCheckpoint | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('训练进度无法读取，请返回后重试。');
  const item = parsed as TrainingCheckpoint;
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    !isTrainingPresetId(item.presetId) ||
    typeof item.startedAt !== 'string' ||
    !Number.isFinite(Date.parse(item.startedAt)) ||
    !Number.isFinite(item.elapsedMs) ||
    item.elapsedMs < 0 ||
    (item.endedAt !== null && (typeof item.endedAt !== 'string' || !Number.isFinite(Date.parse(item.endedAt))))
  )
    throw new Error('训练进度无法读取，请返回后重试。');
  const preset = getTrainingPreset(item.presetId);
  if (
    item.elapsedMs > getTimelineTotalSeconds(buildTrainingTimeline(preset)) * 1000 ||
    (item.endedAt !== null && Date.parse(item.endedAt) < Date.parse(item.startedAt))
  ) {
    throw new Error('训练进度无法读取，请返回后重试。');
  }
  return item;
}

/** monotonicNow 使用 performance.now；系统改时不影响训练时长。持久化只记录已观察的前台进度。 */
export class TrainingClock {
  private runningSince: number | null = null;
  private baseElapsedMs: number;
  private checkpoint: TrainingCheckpoint;
  readonly preset;
  readonly totalSeconds: number;
  readonly recovered: boolean;

  constructor(
    presetId: string | undefined,
    saved: TrainingCheckpoint | null,
    private readonly persist: (checkpoint: TrainingCheckpoint) => void,
    private readonly monotonicNow: () => number = () => performance.now(),
    private readonly wallNow: () => Date = () => new Date(),
  ) {
    this.preset = getTrainingPreset(saved?.presetId ?? presetId);
    this.totalSeconds = getTimelineTotalSeconds(buildTrainingTimeline(this.preset));
    this.recovered = saved !== null;
    this.checkpoint = saved ?? {
      id: `training-${this.wallNow().getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      presetId: this.preset.id,
      startedAt: this.wallNow().toISOString(),
      elapsedMs: 0,
      endedAt: null,
    };
    this.baseElapsedMs = Math.min(this.totalSeconds * 1000, this.checkpoint.elapsedMs);
    // 冷启动绝不把上次进程离开后的时间当作训练；恢复后由用户手动继续。
    if (!saved) this.resume();
  }

  get paused() {
    return this.runningSince === null;
  }
  get finished() {
    return this.checkpoint.endedAt !== null;
  }
  get elapsedSeconds() {
    return Math.floor(this.elapsedMs() / 1000);
  }

  sample() {
    this.checkpoint = { ...this.checkpoint, elapsedMs: this.elapsedMs() };
    try {
      this.persist(this.checkpoint);
    } catch (error) {
      this.baseElapsedMs = this.checkpoint.elapsedMs;
      this.runningSince = null;
      throw error;
    }
  }

  pause() {
    this.baseElapsedMs = this.elapsedMs();
    this.runningSince = null;
    this.sample();
  }

  resume() {
    if (!this.paused || this.finished) return;
    this.sample();
    this.runningSince = this.monotonicNow();
  }

  finish(): TrainingSession {
    this.pause();
    this.checkpoint = {
      ...this.checkpoint,
      endedAt:
        this.checkpoint.endedAt ??
        new Date(Math.max(Date.parse(this.checkpoint.startedAt), this.wallNow().getTime())).toISOString(),
    };
    this.sample();
    const durationSeconds = this.elapsedSeconds;
    return {
      id: this.checkpoint.id,
      presetId: this.preset.id,
      startedAt: this.checkpoint.startedAt,
      endedAt: this.checkpoint.endedAt!,
      durationSeconds,
      completedRepetitions: getCompletedRepetitions(durationSeconds, buildTrainingTimeline(this.preset)),
      isCompleted: durationSeconds >= this.totalSeconds,
      discomfortReported: false,
    };
  }

  private elapsedMs() {
    const sinceResume = this.runningSince === null ? 0 : Math.max(0, this.monotonicNow() - this.runningSince);
    return Math.min(this.totalSeconds * 1000, this.baseElapsedMs + sinceResume);
  }
}
