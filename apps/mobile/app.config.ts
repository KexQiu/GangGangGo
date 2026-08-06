import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const pushEnvironment = process.env.EXPO_PUSH_ENV;
  const runtimeEnvironment = process.env.EXPO_PUBLIC_RUNTIME_ENV ?? 'development';
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const pushEntitlement =
    pushEnvironment === 'development' || pushEnvironment === 'production' ? { 'aps-environment': pushEnvironment } : {};

  assertRemoteApiConfiguration(runtimeEnvironment, apiBaseUrl);

  return {
    ...config,
    name: config.name ?? '小提督',
    slug: config.slug ?? 'xiaotidu',
    version: '0.2.0',
    ios: {
      ...config.ios,
      entitlements: {
        ...config.ios?.entitlements,
        ...pushEntitlement,
      },
    },
  };
};

function assertRemoteApiConfiguration(runtimeEnvironment: string, apiBaseUrl: string | undefined) {
  if (runtimeEnvironment !== 'preview' && runtimeEnvironment !== 'production') {
    return;
  }
  if (!apiBaseUrl) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for ${runtimeEnvironment} builds.`);
  }

  const url = new URL(apiBaseUrl);
  if (url.protocol !== 'https:') {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL must use HTTPS for ${runtimeEnvironment} builds.`);
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL cannot target localhost for ${runtimeEnvironment} builds.`);
  }
}
