import type { AppleLoginRequest } from '@xiaotidu/contracts';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import type { ApiEnv } from '../../config/env.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../http/apiError.js';

export type AppleAuthService = {
  verifyLogin: (request: AppleLoginRequest) => Promise<{
    appleUserId: string;
    nickname?: string;
  }>;
};

type AppleIdentityClaims = JWTPayload & {
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce?: string;
};

export function createMockAppleAuthService(): AppleAuthService {
  return {
    async verifyLogin(request) {
      if (request.nonce || request.identityToken.includes('.')) {
        throw new ApiError(400, 'bad_request', '当前服务尚未启用真实 Apple 登录。');
      }
      return {
        appleUserId: `mock:${request.identityToken}`,
        nickname: request.nickname,
      };
    },
  };
}

export function createAppleJwtAuthService(
  config: Pick<ApiEnv, 'APPLE_BUNDLE_ID' | 'APPLE_JWKS_URL'> = env,
  keySet?: JWTVerifyGetKey,
): AppleAuthService {
  if (!config.APPLE_BUNDLE_ID) {
    throw new ApiError(500, 'internal_server_error', 'Apple 登录配置缺失。');
  }

  const appleJwks = keySet ?? createRemoteJWKSet(new URL(config.APPLE_JWKS_URL));

  return {
    async verifyLogin(request) {
      try {
        if (!request.nonce) throw new ApiError(401, 'unauthorized', 'Apple 登录状态无效，请重新登录。');
        const result = await jwtVerify<AppleIdentityClaims>(request.identityToken, appleJwks, {
          algorithms: ['RS256'],
          audience: config.APPLE_BUNDLE_ID,
          issuer: 'https://appleid.apple.com',
          requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
        });

        if (!result.payload.sub || result.payload.nonce !== request.nonce) {
          throw new ApiError(401, 'unauthorized', 'Apple 登录状态无效，请重新登录。');
        }

        return {
          appleUserId: result.payload.sub,
          nickname: request.nickname,
        };
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof errors.JOSEError) {
          throw new ApiError(401, 'unauthorized', 'Apple 登录状态无效，请重新登录。');
        }

        throw error;
      }
    },
  };
}
