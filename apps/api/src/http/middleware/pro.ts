import { createMiddleware } from 'hono/factory';

import { ApiError } from '../apiError.js';
import type { EntitlementsService } from '../../modules/entitlements/entitlementsService.js';
import type { AuthVariables } from './auth.js';

export function createProMiddleware(entitlementsService: EntitlementsService) {
  return createMiddleware<{ Variables: AuthVariables }>(async (context, next) => {
    const currentUser = context.get('currentUser');
    const entitlements = await entitlementsService.getEntitlements(currentUser);

    const paidAccess = entitlements.proStatus === 'pro_active' || entitlements.proStatus === 'pro_grace_period';
    if (entitlements.commercialMode === 'paid' && !paidAccess) {
      throw new ApiError(403, 'forbidden', '当前账号暂不能使用此功能。');
    }

    await next();
  });
}
