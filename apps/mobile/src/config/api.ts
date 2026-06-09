export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8787';

export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/$/, '');
}
