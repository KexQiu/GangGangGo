import { z } from 'zod';

import { isoDateTimeSchema } from './common.js';
import { userProfileSchema } from './users.js';

export const appleLoginRequestSchema = z.object({
  authorizationCode: z.string().optional(),
  identityToken: z.string().min(1),
  nickname: z.string().optional(),
});
export type AppleLoginRequest = z.infer<typeof appleLoginRequestSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: isoDateTimeSchema,
  refreshToken: z.string().min(1),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authResponseSchema = z.object({
  session: authSessionSchema,
  user: userProfileSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshSessionRequestSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshSessionRequest = z.infer<typeof refreshSessionRequestSchema>;

export const logoutRequestSchema = z.object({ refreshToken: z.string().min(1).optional() });
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
