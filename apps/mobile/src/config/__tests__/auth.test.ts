import { describe, expect, it } from 'vitest';
import { isMockLoginEnabled } from '../auth';

describe('development login boundary', () => {
  it('requires an explicit flag in a development build', () => {
    expect(isMockLoginEnabled(true, 'development', '1')).toBe(true);
    expect(isMockLoginEnabled(true, undefined, '1')).toBe(true);
    expect(isMockLoginEnabled(true, 'development', undefined)).toBe(false);
    expect(isMockLoginEnabled(false, 'development', '1')).toBe(false);
  });
  it.each(['preview', 'production', 'test', 'unknown'])(
    'rejects mock login in %s even with a development JS bundle',
    (environment) => {
      expect(isMockLoginEnabled(true, environment, '1')).toBe(false);
    },
  );
});
