import { z } from 'zod';

export const isoDateSchema = z.iso.date().meta({ id: 'IsoDate' });
export const isoDateTimeSchema = z.string().datetime({ offset: true }).meta({ id: 'IsoDateTime' });

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

export const apiErrorResponseSchema = z
  .object({
    error: z.object({
      code: apiErrorCodeSchema,
      details: z.unknown().optional(),
      message: z.string(),
    }),
  })
  .meta({ id: 'ApiErrorResponse' });
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export type ApiSuccessResponse<T> = { data: T };

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const quietRangeSchema = z
  .object({
    end: localTimeSchema,
    start: localTimeSchema,
  })
  .strict();
export type QuietRange = z.infer<typeof quietRangeSchema>;

export const entitlementsResponseSchema = z.object({ proStatus: proStatusSchema }).meta({ id: 'EntitlementsResponse' });
export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;

export const apiHealthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.literal('xiaotidu-api'),
    version: z.string(),
  })
  .meta({ id: 'ApiHealthResponse' });
export type ApiHealthResponse = z.infer<typeof apiHealthResponseSchema>;

export const databaseHealthResponseSchema = z
  .object({
    database: z.literal('reachable'),
    ok: z.literal(true),
  })
  .meta({ id: 'DatabaseHealthResponse' });
export type DatabaseHealthResponse = z.infer<typeof databaseHealthResponseSchema>;
