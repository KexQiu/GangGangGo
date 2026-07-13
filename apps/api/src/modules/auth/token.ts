import { jwtVerify, SignJWT } from 'jose';

import { env } from '../../config/env.js';
import { ApiError } from '../../http/apiError.js';

const accessTokenLifetimeSeconds = 15 * 60;
const issuer = 'xiaotidu-api';
const audience = 'xiaotidu-mobile';

export type AccessTokenPayload = {
  exp: number;
  sessionId: string;
  sub: string;
};

function secretKey(secret = env.JWT_SECRET) {
  return new TextEncoder().encode(secret);
}

export async function issueAccessToken(
  userId: string,
  sessionId: string,
  options: { expiresInSeconds?: number; secret?: string } = {},
) {
  const expiresInSeconds = options.expiresInSeconds ?? accessTokenLifetimeSeconds;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + expiresInSeconds) * 1000);
  const accessToken = await new SignJWT({ sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey(options.secret));

  return { accessToken, accessTokenExpiresAt: expiresAt.toISOString() };
}

export async function verifyAccessToken(token: string, options: { secret?: string } = {}): Promise<AccessTokenPayload> {
  try {
    const result = await jwtVerify(token, secretKey(options.secret), { audience, issuer });
    const sessionId = result.payload.sessionId;

    if (!result.payload.sub || typeof sessionId !== 'string' || typeof result.payload.exp !== 'number') {
      throw new Error('Invalid access token payload.');
    }

    return { exp: result.payload.exp, sessionId, sub: result.payload.sub };
  } catch {
    throw new ApiError(401, 'unauthorized', '登录状态无效或已过期，请重新登录。');
  }
}
