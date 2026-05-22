import { createMiddleware } from 'hono/factory';

import { ApiError } from '../apiError.js';
import type { EntitlementsService } from '../../modules/entitlements/entitlementsService.js';
import type { AuthVariables } from './auth.js';

export function createProMiddleware(entitlementsService: EntitlementsService) {
  return createMiddleware<{ Variables: AuthVariables }>(async (context, next) => {
    const currentUser = context.get('currentUser');
    const entitlements = await entitlementsService.getEntitlements(currentUser);

    if (entitlements.proStatus !== 'pro_active' && entitlements.proStatus !== 'pro_grace_period') {
      throw new ApiError(403, 'forbidden', '这是小提督 Pro 功能。');
    }

    await next();
  });
}
