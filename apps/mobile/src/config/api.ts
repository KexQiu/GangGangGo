export type MobileRuntimeEnvironment = 'development' | 'preview' | 'production' | 'test';

const runtimeEnvironment = parseRuntimeEnvironment(process.env.EXPO_PUBLIC_RUNTIME_ENV, process.env.NODE_ENV);

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, runtimeEnvironment);

export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/$/, '');
}

export function resolveApiBaseUrl(configuredValue: string | undefined, environment: MobileRuntimeEnvironment): string {
  const configured = configuredValue?.trim();
  if (environment === 'development' || environment === 'test') {
    return configured || 'http://localhost:8787';
  }

  if (!configured) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for ${environment} builds.`);
  }

  const url = new URL(configured);
  if (url.protocol !== 'https:') {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL must use HTTPS for ${environment} builds.`);
  }
  if (isLoopbackHostname(url.hostname)) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL cannot target localhost for ${environment} builds.`);
  }

  return configured;
}

function parseRuntimeEnvironment(
  value: string | undefined,
  nodeEnvironment: string | undefined,
): MobileRuntimeEnvironment {
  if (value === 'development' || value === 'preview' || value === 'production' || value === 'test') {
    return value;
  }
  return nodeEnvironment === 'test' ? 'test' : 'development';
}

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
