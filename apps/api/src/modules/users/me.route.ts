import { createRoute } from '@hono/zod-openapi';

import {
  entitlementsResponseSchema,
  updateUserProfileRequestSchema,
  userProfileSchema,
  type EntitlementsResponse,
} from '@xiaotidu/contracts';

import { apiResponses, bearerSecurity, createOpenApiRouter, jsonRequest } from '../../http/openapi.js';
import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { EntitlementsService } from '../entitlements/entitlementsService.js';
import type { UserRepository } from './userRepository.js';
import { toUserProfile } from './users.mapper.js';

type CreateMeRouteOptions = {
  entitlementsService: EntitlementsService;
  userRepository: UserRepository;
};

export function createMeRoute(options: CreateMeRouteOptions) {
  const route = createOpenApiRouter<{ Variables: AuthVariables }>();

  route.openapi(
    createRoute({
      method: 'get',
      path: '/',
      responses: apiResponses(userProfileSchema),
      security: bearerSecurity,
      summary: '当前用户',
    }),
    (context) => {
      const currentUser = context.get('currentUser');

      return context.json(toSuccessResponse(toUserProfile(currentUser)), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'patch',
      path: '/',
      request: { body: jsonRequest(updateUserProfileRequestSchema) },
      responses: apiResponses(userProfileSchema),
      security: bearerSecurity,
      summary: '更新用户资料',
    }),
    async (context) => {
      const currentUser = context.get('currentUser');
      const updatedUser = await options.userRepository.updateProfile(currentUser.id, context.req.valid('json'));

      return context.json(toSuccessResponse(toUserProfile(updatedUser)), 200);
    },
  );

  route.openapi(
    createRoute({
      method: 'get',
      path: '/entitlements',
      responses: apiResponses(entitlementsResponseSchema),
      security: bearerSecurity,
      summary: '会员权益',
    }),
    async (context) => {
      const body: EntitlementsResponse = await options.entitlementsService.getEntitlements(context.get('currentUser'));

      return context.json(toSuccessResponse(body), 200);
    },
  );

  return route;
}
