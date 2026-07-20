import { describe, expect, it } from 'vitest';

import { shouldPollNudges } from '../nudgePolling';

describe('nudge polling', () => {
  it('only polls with a session on a focused foreground screen', () => {
    expect(shouldPollNudges({ hasSession: true, isAppActive: true, isFocused: true })).toBe(true);
    expect(shouldPollNudges({ hasSession: false, isAppActive: true, isFocused: true })).toBe(false);
    expect(shouldPollNudges({ hasSession: true, isAppActive: false, isFocused: true })).toBe(false);
    expect(shouldPollNudges({ hasSession: true, isAppActive: true, isFocused: false })).toBe(false);
  });

  it('requires a target for thread polling', () => {
    expect(shouldPollNudges({ hasSession: true, hasTarget: false, isAppActive: true, isFocused: true })).toBe(false);
  });
});
