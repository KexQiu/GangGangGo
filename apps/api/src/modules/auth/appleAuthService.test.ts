import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';

import { createAppleJwtAuthService, createMockAppleAuthService, type AppleAuthService } from './appleAuthService.js';
import { createApiApp } from '../../app.js';

const nonce = '12345678-1234-1234-1234-123456789012';
const audience = 'com.kex.xiaotidu';
const issuer = 'https://appleid.apple.com';
let privateKey: CryptoKey;
let service: AppleAuthService;

beforeAll(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256' };
  service = createAppleJwtAuthService(
    { APPLE_BUNDLE_ID: audience, APPLE_JWKS_URL: 'https://appleid.apple.com/auth/keys' },
    createLocalJWKSet({ keys: [jwk] }),
  );
});

async function token(overrides: JWTPayload = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: 'apple-user', aud: audience, iss: issuer, iat: now, exp: now + 300, nonce, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(key);
}

describe('apple auth service', () => {
  it('fails fast without a bundle id', () => {
    expect(() =>
      createAppleJwtAuthService({ APPLE_BUNDLE_ID: undefined, APPLE_JWKS_URL: 'https://appleid.apple.com/auth/keys' }),
    ).toThrow('Apple 登录配置缺失');
  });
  it('verifies a signed Apple-shaped identity token and matching nonce', async () => {
    expect(await service.verifyLogin({ identityToken: await token(), nonce, nickname: '小花' })).toEqual({
      appleUserId: 'apple-user',
      nickname: '小花',
    });
  });
  it.each([
    { aud: 'another-app' },
    { iss: 'https://another-issuer.invalid' },
    { exp: 1 },
    { exp: undefined },
    { iat: undefined },
    { sub: '' },
    { nonce: 'another-attempt' },
    { nonce: undefined },
  ])('rejects invalid or missing required claims: %j', async (claims) => {
    await expect(service.verifyLogin({ identityToken: await token(claims), nonce })).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  it('requires a nonce from the real login request', async () => {
    await expect(service.verifyLogin({ identityToken: await token() })).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rejects a signature from a different key', async () => {
    const other = await generateKeyPair('RS256');
    await expect(
      service.verifyLogin({ identityToken: await token({}, other.privateKey), nonce }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
  it('rejects mock tokens in real mode', async () => {
    await expect(service.verifyLogin({ identityToken: 'mock-user-a', nonce })).rejects.toMatchObject({
      statusCode: 401,
    });
  });
  it('does not silently create a mock identity for native login in mock mode', async () => {
    await expect(
      createMockAppleAuthService().verifyLogin({ identityToken: await token(), nonce }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('supports first login, logout and login again through the real verifier route', async () => {
    const app = createApiApp({ appleAuthService: service });
    const login = async (nickname?: string) => {
      const response = await app.request('/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken: await token(), nonce, ...(nickname ? { nickname } : {}) }),
      });
      expect(response.status).toBe(200);
      return (await response.json()).data;
    };
    const first = await login('首次名字');
    const logout = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${first.session.accessToken}` },
    });
    expect(logout.status).toBe(200);
    const next = await login();
    expect(next.user.id).toBe(first.user.id);
    expect(next.user.nickname).toBe('首次名字');
    expect(next.session.accessToken).not.toBe(first.session.accessToken);
    const invalid = await app.request('/auth/apple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: await token({ exp: 1 }), nonce }),
    });
    expect(invalid.status).toBe(401);
  });
});
