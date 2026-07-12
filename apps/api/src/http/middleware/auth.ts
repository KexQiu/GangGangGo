import { createMiddleware } from 'hono/factory';

import { ApiError } from '../apiError.js';
import { verifyAccessToken } from '../../modules/auth/token.js';
import type { AuthSessionService } from '../../modules/auth/authSessionService.js';
import type { UserRepository } from '../../modules/users/userRepository.js';
import type { CurrentUser } from '../../modules/users/userTypes.js';

export type AuthVariables = {
  currentUser: CurrentUser;
  sessionId: string;
};

export function createAuthMiddleware(userRepository: UserRepository, authSessionService: AuthSessionService) {
  return createMiddleware<{ Variables: AuthVariables }>(async (context, next) => {
    const authorization = context.req.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;

    if (!token) {
      throw new ApiError(401, 'unauthorized', '请先登录。');
    }

    const payload = await verifyAccessToken(token);
    const isActive = await authSessionService.isActive(payload.sessionId, payload.sub);
    if (!isActive) throw new ApiError(401, 'unauthorized', '登录状态已失效，请重新登录。');
    const currentUser = await userRepository.findById(payload.sub);

    if (!currentUser) {
      throw new ApiError(401, 'unauthorized', '登录状态无效，请重新登录。');
    }

    context.set('currentUser', currentUser);
    context.set('sessionId', payload.sessionId);
    await next();
  });
}
