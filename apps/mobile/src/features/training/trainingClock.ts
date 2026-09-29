import { trainingSessionSyncPayloadSchema, validTrainingParameters } from '@xiaotidu/contracts';
import { getTrainingPreset, isTrainingPresetId } from './presets';
import type { TrainingPreset, TrainingSession, TrainingFeedback, TrainingEndReason } from './trainingTypes';

export const TRAINING_LATE_TOLERANCE_MS = 250;
export type ClockPhase = 'prepare' | 'contract' | 'relax' | 'ended';
export type TrainingCheckpoint = {
  version: 2;
  id: string;
  presetId: TrainingPreset['id'];
  plan: TrainingSession['plan'];
  startedAt: string;
  updatedAt: string;
  elapsedMs: number;
  phase: ClockPhase;
  phaseElapsedMs: number;
  completedRepetitions: number;
  contractionComplete: boolean;
  interrupted: boolean;
  submissionLocked: boolean;
  draft: TrainingSession | null;
};
export function parseTrainingCheckpoint(value: string | null): TrainingCheckpoint | null {
  if (!value) return null;
  const item = JSON.parse(value) as TrainingCheckpoint;
  if (
    !item ||
    item.version !== 2 ||
    !item.id ||
    !isTrainingPresetId(item.presetId) ||
    !validTrainingParameters(item.presetId, item.plan) ||
    !Number.isFinite(Date.parse(item.startedAt)) ||
    !Number.isFinite(Date.parse(item.updatedAt)) ||
    !Number.isFinite(item.elapsedMs) ||
    item.elapsedMs < 0 ||
    !['prepare', 'contract', 'relax', 'ended'].includes(item.phase) ||
    !Number.isFinite(item.phaseElapsedMs) ||
    item.phaseElapsedMs < 0 ||
    !Number.isInteger(item.completedRepetitions) ||
    item.completedRepetitions < 0 ||
    item.completedRepetitions > item.plan.repetitions ||
    typeof item.contractionComplete !== 'boolean' ||
    typeof item.interrupted !== 'boolean'
  ) {
    throw new Error('训练进度无法读取，请返回后重试。');
  }
  if (item.draft)
    trainingSessionSyncPayloadSchema.parse({
      ...withoutId(item.draft),
      localDate: localDay(new Date(item.draft.endedAt)),
    });
  return item;
}
function withoutId({ id: _id, ...session }: TrainingSession) {
  return session;
}
function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 阶段只能在收到边界回调后推进；墙钟仅用于记录日期。 */
export class TrainingClock {
  private runningSince: number | null = null;
  private awaitingPrompt = false;
  private promptSequence = 0;
  private checkpoint: TrainingCheckpoint;
  readonly preset: TrainingPreset;
  readonly totalSeconds: number;
  readonly recovered: boolean;

  constructor(
    preset: TrainingPreset | string | undefined,
    saved: TrainingCheckpoint | null,
    private readonly persist: (checkpoint: TrainingCheckpoint) => void,
    private readonly monotonicNow: () => number = () => performance.now(),
    private readonly wallNow: () => Date = () => new Date(),
  ) {
    const chosen = typeof preset === 'object' ? preset : getTrainingPreset(preset);
    this.preset = saved ? { ...getTrainingPreset(saved.presetId), ...saved.plan } : { ...chosen };
    this.totalSeconds = (this.preset.contractSeconds + this.preset.relaxSeconds) * this.preset.repetitions;
    this.recovered = saved !== null;
    const now = this.wallNow().toISOString();
    this.checkpoint = saved
      ? JSON.parse(JSON.stringify(saved))
      : {
          version: 2,
          id: `training-${this.wallNow().getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          presetId: this.preset.id,
          plan: {
            contractSeconds: this.preset.contractSeconds,
            relaxSeconds: this.preset.relaxSeconds,
            repetitions: this.preset.repetitions,
          },
          startedAt: now,
          updatedAt: now,
          elapsedMs: 0,
          phase: 'prepare',
          phaseElapsedMs: 0,
          completedRepetitions: 0,
          contractionComplete: false,
          interrupted: false,
          submissionLocked: false,
          draft: null,
        };
    if (!saved) {
      this.awaitingPrompt = true;
      this.save();
    }
  }
  get stale() {
    return this.paused && !this.finished && localDay(new Date(this.checkpoint.updatedAt)) !== localDay(this.wallNow());
  }
  get paused() {
    return this.runningSince === null && !this.awaitingPrompt;
  }
  get promptRevision() {
    return this.promptSequence;
  }
  confirmPrompt() {
    if (!this.awaitingPrompt || this.finished) return false;
    this.checkpoint.updatedAt = this.wallNow().toISOString();
    this.save();
    this.awaitingPrompt = false;
    // 保存期间无法确认提示有效的时间不占用新阶段。
    this.runningSince = this.monotonicNow();
    return true;
  }
  get finished() {
    return this.checkpoint.phase === 'ended';
  }
  get submissionLocked() {
    return this.checkpoint.submissionLocked;
  }
  lockSubmission() {
    this.checkpoint.submissionLocked = true;
    this.save();
  }
  get draft() {
    return this.checkpoint.draft;
  }
  get phase() {
    return this.checkpoint.phase;
  }
  get interrupted() {
    return this.checkpoint.interrupted;
  }
  get completedRepetitions() {
    return this.checkpoint.completedRepetitions;
  }
  get elapsedSeconds() {
    return Math.floor(
      (this.checkpoint.elapsedMs + (this.phase === 'prepare' || this.finished ? 0 : this.observedDelta())) / 1000,
    );
  }
  get remainingSeconds() {
    return Math.ceil(
      Math.max(0, this.phaseDurationMs() - this.checkpoint.phaseElapsedMs - this.observedDelta()) / 1000,
    );
  }
  get nextBoundaryDelay() {
    return this.paused || this.finished || this.awaitingPrompt
      ? null
      : Math.max(0, this.phaseDurationMs() - this.checkpoint.phaseElapsedMs - this.delta());
  }

  sample() {
    if (this.paused || this.finished || this.awaitingPrompt) return;
    this.checkpoint.updatedAt = this.wallNow().toISOString();
    const delta = this.delta();
    const remaining = this.phaseDurationMs() - this.checkpoint.phaseElapsedMs;
    this.accumulate(Math.min(delta, remaining));
    this.runningSince = this.monotonicNow();
    if (delta > remaining + TRAINING_LATE_TOLERANCE_MS) {
      this.runningSince = null;
      this.checkpoint.interrupted = true;
      // 收缩边界未被确认，不能把它换算成已完成的动作。
      if (this.phase === 'contract') this.checkpoint.contractionComplete = false;
    } else if (delta >= remaining) {
      if (this.phase === 'prepare') this.enter('contract');
      else if (this.phase === 'contract') {
        this.checkpoint.contractionComplete = true;
        this.enter('relax');
      } else if (this.phase === 'relax') {
        if (this.checkpoint.contractionComplete) this.checkpoint.completedRepetitions += 1;
        this.checkpoint.contractionComplete = false;
        if (this.completedRepetitions === this.preset.repetitions) this.finish('completed');
        else this.enter('contract');
      }
    }
    this.save();
  }
  pause() {
    if (!this.paused && !this.finished) {
      this.accumulate(this.observedDelta());
      this.checkpoint.updatedAt = this.wallNow().toISOString();
    }
    this.runningSince = null;
    this.awaitingPrompt = false;
    this.save();
  }
  resume() {
    if (!this.paused || this.finished || this.stale) return;
    this.checkpoint.updatedAt = this.wallNow().toISOString();
    this.checkpoint.interrupted = false;
    this.enter('relax');
    this.save();
  }
  finish(reason: TrainingEndReason = 'user_stopped'): TrainingSession {
    if (this.checkpoint.draft) return this.checkpoint.draft;
    this.pause();
    const completed = this.completedRepetitions === this.preset.repetitions;
    this.checkpoint.phase = 'ended';
    this.checkpoint.draft = {
      id: this.checkpoint.id,
      presetId: this.preset.id,
      plan: { ...this.checkpoint.plan },
      startedAt: this.checkpoint.startedAt,
      endedAt: this.wallNow().toISOString(),
      durationSeconds: Math.floor(this.checkpoint.elapsedMs / 1000),
      completedRepetitions: this.completedRepetitions,
      isCompleted: completed,
      feedback: reason === 'discomfort' ? 'reported' : 'unanswered',
      endReason: completed ? 'completed' : reason,
    };
    this.save();
    return this.checkpoint.draft;
  }
  setFeedback(feedback: TrainingFeedback) {
    if (!this.checkpoint.draft) throw new Error('请先结束训练。');
    if (this.submissionLocked) return this.checkpoint.draft;
    this.checkpoint.draft = { ...this.checkpoint.draft, feedback };
    this.save();
    return this.checkpoint.draft;
  }
  private enter(phase: ClockPhase) {
    this.checkpoint.phase = phase;
    this.checkpoint.phaseElapsedMs = 0;
    this.awaitingPrompt = true;
    this.runningSince = null;
    this.promptSequence += 1;
  }
  private delta() {
    return this.runningSince === null ? 0 : Math.max(0, this.monotonicNow() - this.runningSince);
  }
  private observedDelta() {
    return Math.min(this.delta(), Math.max(0, this.phaseDurationMs() - this.checkpoint.phaseElapsedMs));
  }
  private accumulate(delta: number) {
    if (this.phase !== 'prepare' && this.phase !== 'ended') this.checkpoint.elapsedMs += delta;
    this.checkpoint.phaseElapsedMs += delta;
  }
  private phaseDurationMs() {
    return this.phase === 'prepare'
      ? 3000
      : this.phase === 'contract'
        ? this.preset.contractSeconds * 1000
        : this.phase === 'relax'
          ? this.preset.relaxSeconds * 1000
          : 0;
  }
  private save() {
    try {
      this.persist(JSON.parse(JSON.stringify(this.checkpoint)));
    } catch (error) {
      this.runningSince = null;
      this.awaitingPrompt = false;
      throw error;
    }
  }
}
