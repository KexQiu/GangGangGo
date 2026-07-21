import {
  type ToiletRecordDraft,
  type ToiletSession,
  type ToiletSignal,
  type ToiletStoolColor,
  type ToiletStoolShape,
} from './toiletTypes';

export const MAX_CUSTOM_TOILET_SIGNAL_PRESETS = 8;
export const MAX_TOILET_SIGNALS_PER_SESSION = 5;
export const MAX_TOILET_SIGNAL_LABEL_LENGTH = 12;

export const toiletStoolShapeOptions: Array<{ label: string; value: ToiletStoolShape }> = [
  { label: '偏硬', value: 'hard' },
  { label: '成形', value: 'formed' },
  { label: '偏稀', value: 'loose' },
];

export const toiletStoolColorOptions: Array<{ label: string; value: ToiletStoolColor }> = [
  { label: '常见颜色', value: 'normal' },
  { label: '需要留意', value: 'attention' },
  { label: '其他', value: 'other' },
];

export const builtInToiletSignals: ToiletSignal[] = [
  { id: 'builtin-abdominal-pain', label: '腹痛' },
  { id: 'builtin-bloating', label: '腹胀' },
  { id: 'builtin-incomplete', label: '排便不尽' },
  { id: 'builtin-frequency-change', label: '次数变化' },
];

const toiletStoolShapes = new Set<ToiletStoolShape>(toiletStoolShapeOptions.map((option) => option.value));
const toiletStoolColors = new Set<ToiletStoolColor>(toiletStoolColorOptions.map((option) => option.value));

export function createToiletRecordDraft(session: ToiletSession): ToiletRecordDraft {
  return {
    bleeding: session.bleeding,
    discomfort: session.discomfort,
    durationSeconds: session.durationSeconds,
    feeling: session.feeling,
    signals: normalizeToiletSignals(session.signals),
    stoolColor: session.stoolColor ?? null,
    stoolShape: session.stoolShape ?? null,
  };
}

export function getToiletStoolShapeLabel(value: ToiletStoolShape | null | undefined): string | null {
  return toiletStoolShapeOptions.find((option) => option.value === value)?.label ?? null;
}

export function getToiletStoolColorLabel(value: ToiletStoolColor | null | undefined): string | null {
  return toiletStoolColorOptions.find((option) => option.value === value)?.label ?? null;
}

export function isToiletStoolShape(value: unknown): value is ToiletStoolShape {
  return typeof value === 'string' && toiletStoolShapes.has(value as ToiletStoolShape);
}

export function isToiletStoolColor(value: unknown): value is ToiletStoolColor {
  return typeof value === 'string' && toiletStoolColors.has(value as ToiletStoolColor);
}

export function normalizeToiletSignalLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_TOILET_SIGNAL_LABEL_LENGTH);
}

export function normalizeToiletSignals(value: unknown): ToiletSignal[] {
  if (!Array.isArray(value)) return [];

  const signalIds = new Set<string>();
  const signals: ToiletSignal[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const signal = item as Partial<ToiletSignal>;
    const label = typeof signal.label === 'string' ? normalizeToiletSignalLabel(signal.label) : '';
    if (typeof signal.id !== 'string' || signal.id.length === 0 || label.length === 0 || signalIds.has(signal.id))
      continue;

    signalIds.add(signal.id);
    signals.push({ id: signal.id, label });
    if (signals.length >= MAX_TOILET_SIGNALS_PER_SESSION) break;
  }

  return signals;
}
