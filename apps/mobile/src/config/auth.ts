export function isMockLoginEnabled(
  isDevelopmentBuild: boolean,
  environment: string | undefined,
  enabled: string | undefined,
) {
  return isDevelopmentBuild && (environment === undefined || environment === 'development') && enabled === '1';
}

export const MOCK_LOGIN_ENABLED = isMockLoginEnabled(
  typeof __DEV__ !== 'undefined' && __DEV__,
  process.env.EXPO_PUBLIC_RUNTIME_ENV,
  process.env.EXPO_PUBLIC_ENABLE_MOCK_LOGIN,
);
