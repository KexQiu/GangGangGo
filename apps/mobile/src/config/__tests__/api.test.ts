import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from '../api';

describe('mobile API configuration', () => {
  it('uses localhost only for development and tests', () => {
    expect(resolveApiBaseUrl(undefined, 'development')).toBe('http://localhost:8787');
    expect(resolveApiBaseUrl(undefined, 'test')).toBe('http://localhost:8787');
  });

  it('requires a remote HTTPS endpoint for preview and production', () => {
    expect(() => resolveApiBaseUrl(undefined, 'production')).toThrow(/required/);
    expect(() => resolveApiBaseUrl('http://api.example.com', 'preview')).toThrow(/HTTPS/);
    expect(() => resolveApiBaseUrl('https://localhost:8787', 'production')).toThrow(/localhost/);
    expect(resolveApiBaseUrl('https://api.example.com/', 'production')).toBe('https://api.example.com/');
  });
});
