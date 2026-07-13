export const nudgePollIntervalMs = 15_000;

export function shouldPollNudges(input: {
  hasSession: boolean;
  hasTarget?: boolean;
  isAppActive: boolean;
  isFocused: boolean;
}): boolean {
  return input.hasSession && (input.hasTarget ?? true) && input.isAppActive && input.isFocused;
}
