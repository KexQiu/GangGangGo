import { Hono } from 'hono';

import type {
  EntitlementsResponse,
  UpdateUserProfileRequest,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../../http/middleware/auth.js';
import { toSuccessResponse } from '../../http/responses.js';
import type { EntitlementsService } from '../entitlements/entitlementsService.js';
import type { UserRepository } from './userRepository.js';
import { toUserProfile } from './users.mapper.js';
import { updateUserProfileRequestSchema } from './users.schemas.js';

type CreateMeRouteOptions = {
  entitlementsService: EntitlementsService;
  userRepository: UserRepository;
};

export function createMeRoute(options: CreateMeRouteOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();

  route.get('/', (context) => {
    const currentUser = context.get('currentUser');

    return context.json(toSuccessResponse(toUserProfile(currentUser)));
  });

  route.patch('/', async (context) => {
    const currentUser = context.get('currentUser');
    const request: UpdateUserProfileRequest = updateUserProfileRequestSchema.parse(await context.req.json());
    const updatedUser = await options.userRepository.updateProfile(currentUser.id, request);

    return context.json(toSuccessResponse(toUserProfile(updatedUser)));
  });

  route.get('/entitlements', async (context) => {
    const body: EntitlementsResponse = await options.entitlementsService.getEntitlements(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  return route;
}
