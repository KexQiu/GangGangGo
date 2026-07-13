import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const pushEnvironment = process.env.EXPO_PUSH_ENV;
  const pushEntitlement =
    pushEnvironment === 'development' || pushEnvironment === 'production' ? { 'aps-environment': pushEnvironment } : {};

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
