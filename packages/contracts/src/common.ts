import { z } from 'zod';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const proStatusSchema = z.enum(['free', 'pro_active', 'pro_grace_period', 'pro_expired']);
export type ProStatus = z.infer<typeof proStatusSchema>;

export const apiErrorCodeSchema = z.enum([
  'bad_request',
  'conflict',
  'database_not_configured',
  'database_unreachable',
  'forbidden',
  'internal_error',
  'internal_server_error',
  'not_found',
  'rate_limited',
  'unauthorized',
  'validation_error',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    details: z.unknown().optional(),
    message: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export type ApiSuccessResponse<T> = { data: T };

export const quietRangeSchema = z.object({
  end: z.string(),
  start: z.string(),
});
export type QuietRange = z.infer<typeof quietRangeSchema>;

export const entitlementsResponseSchema = z.object({ proStatus: proStatusSchema });
export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;

export const apiHealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('xiaotidu-api'),
  version: z.string(),
});
export type ApiHealthResponse = z.infer<typeof apiHealthResponseSchema>;

export const databaseHealthResponseSchema = z.object({
  database: z.literal('reachable'),
  ok: z.literal(true),
});
export type DatabaseHealthResponse = z.infer<typeof databaseHealthResponseSchema>;
