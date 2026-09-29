import { describe, expect, it } from 'vitest';
import { themeColors } from '../colors';

function luminance(hex: string) {
  const components = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
}
function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [scheme, colors] of Object.entries(themeColors)) {
  describe(`${scheme} text contrast`, () => {
    it('keeps normal and pressed primary button text above 4.5:1', () => {
      for (const background of [colors.primary, colors.primaryPressed])
        expect(contrast(colors.primaryForeground, background)).toBeGreaterThanOrEqual(4.5);
    });
    it('keeps regular, secondary and disabled text readable on app surfaces', () => {
      for (const foreground of [colors.text, colors.textMuted, colors.textSubtle])
        for (const background of [colors.background, colors.surface, colors.surfaceMuted])
          expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    });
    it('keeps selected and warning/error labels readable on their soft surfaces', () => {
      for (const [foreground, background] of [
        [colors.primaryPressed, colors.primarySoft],
        [colors.warning, colors.warningSoft],
        [colors.danger, colors.dangerSoft],
        [colors.info, colors.infoSoft],
        [colors.text, colors.warningSoft],
      ])
        expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    });
  });
}
