import { Hono } from 'hono';
import { z } from 'zod';

import type {
  CreateAvatarUploadRequest,
  CreateAvatarUploadResponse,
  EntitlementsResponse,
  UpdateUserProfileRequest,
  UserProfile,
} from '@xiaotidu/contracts';

import type { AuthVariables } from '../http/middleware/auth.js';
import { toSuccessResponse } from '../http/responses.js';
import type { EntitlementsService } from '../modules/entitlements/entitlementsService.js';
import type { AvatarStorageService } from '../modules/storage/avatarStorageService.js';
import type { CurrentUser } from '../modules/users/userTypes.js';
import type { UserRepository } from '../modules/users/userRepository.js';

type CreateMeRouteOptions = {
  avatarStorageService: AvatarStorageService;
  entitlementsService: EntitlementsService;
  userRepository: UserRepository;
};

const createAvatarUploadRequestSchema = z
  .object({
    contentLength: z.number().int().positive().max(300 * 1024),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })
  .strict();

const updateUserProfileRequestSchema = z
  .object({
    avatarUrl: z.string().trim().max(500).nullable().optional(),
    nickname: z.string().trim().min(1).max(20).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

function toUserProfile(user: CurrentUser): UserProfile {
  return {
    avatarUrl: user.avatarUrl,
    id: user.id,
    nickname: user.nickname,
    timezone: user.timezone,
  };
}

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

  route.post('/avatar-upload', async (context) => {
    const currentUser = context.get('currentUser');
    const request: CreateAvatarUploadRequest = createAvatarUploadRequestSchema.parse(await context.req.json());
    const origin = new URL(context.req.url).origin;
    const body: CreateAvatarUploadResponse = await options.avatarStorageService.createUpload({
      contentLength: request.contentLength,
      contentType: request.contentType,
      origin,
      userId: currentUser.id,
    });

    return context.json(toSuccessResponse(body));
  });

  route.get('/entitlements', async (context) => {
    const body: EntitlementsResponse = await options.entitlementsService.getEntitlements(context.get('currentUser'));

    return context.json(toSuccessResponse(body));
  });

  return route;
}
