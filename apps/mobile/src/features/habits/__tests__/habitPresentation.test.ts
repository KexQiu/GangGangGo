import { describe, expect, it } from 'vitest';

import { themeColors } from '../../../theme/colors';
import { getLevelTone, getQuickHabitAction } from '../habitPresentation';

describe('quick habit recording', () => {
  it('opens existing partial records for editing instead of overwriting them with the highest tier', () => {
    for (const key of ['water', 'fiber', 'movement'] as const) {
      expect(getQuickHabitAction(key, 'low')).toBe('edit');
      expect(getQuickHabitAction(key, 'medium')).toBe('edit');
      expect(getQuickHabitAction(key, null)).toBe('record');
      expect(getQuickHabitAction(key, 'good')).toBe('clear');
    }
  });

  it('always asks for actual bowel status, including an explicit no-movement record', () => {
    for (const level of [null, 'low', 'medium', 'good', 'not_today'] as const) {
      expect(getQuickHabitAction('bowel', level)).toBe('edit');
    }
  });
});

describe('habit record tones', () => {
  it('gives every quantity tier the same selected tone in both themes', () => {
    for (const colors of Object.values(themeColors)) {
      for (const key of ['water', 'fiber', 'movement'] as const) {
        const tone = getLevelTone(colors, 'good', key);
        expect(getLevelTone(colors, 'low', key)).toEqual(tone);
        expect(getLevelTone(colors, 'medium', key)).toEqual(tone);
      }
    }
  });

  it('keeps no bowel movement neutral and preserves the discomfort cue', () => {
    for (const colors of Object.values(themeColors)) {
      expect(getLevelTone(colors, 'not_today', 'bowel').color).toBe(colors.textMuted);
      expect(getLevelTone(colors, 'low', 'bowel').color).toBe(colors.warning);
    }
  });
});
