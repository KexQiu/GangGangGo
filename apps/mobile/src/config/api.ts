export const API_BASE_URL = 'http://localhost:8787';

export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/$/, '');
}
