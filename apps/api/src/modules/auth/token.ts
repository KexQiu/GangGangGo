import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import { ApiError } from '../../http/apiError.js';

type TokenPayload = {
  exp: number;
  sub: string;
};

const textEncoder = new TextEncoder();

function base64UrlEncode(input: string | Uint8Array) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(unsignedToken: string, secret: string) {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url');
}

export function issueAccessToken(userId: string, options: { expiresInSeconds?: number; secret?: string } = {}) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const payload: TokenPayload = {
    exp: Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 60 * 60 * 24 * 30),
    sub: userId,
  };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = sign(unsignedToken, options.secret ?? env.JWT_SECRET);

  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token: string, options: { now?: number; secret?: string } = {}) {
  const [headerPart, payloadPart, signaturePart] = token.split('.');

  if (!headerPart || !payloadPart || !signaturePart) {
    throw new ApiError(401, 'unauthorized', '登录状态无效，请重新登录。');
  }

  const unsignedToken = `${headerPart}.${payloadPart}`;
  const expectedSignature = sign(unsignedToken, options.secret ?? env.JWT_SECRET);
  const expectedBytes = textEncoder.encode(expectedSignature);
  const actualBytes = textEncoder.encode(signaturePart);

  if (expectedBytes.byteLength !== actualBytes.byteLength || !timingSafeEqual(expectedBytes, actualBytes)) {
    throw new ApiError(401, 'unauthorized', '登录状态无效，请重新登录。');
  }

  let payload: TokenPayload;

  try {
    payload = JSON.parse(base64UrlDecode(payloadPart)) as TokenPayload;
  } catch {
    throw new ApiError(401, 'unauthorized', '登录状态无效，请重新登录。');
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);

  if (!payload.sub || payload.exp <= now) {
    throw new ApiError(401, 'unauthorized', '登录已过期，请重新登录。');
  }

  return payload;
}
