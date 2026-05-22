import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly statusCode: ContentfulStatusCode;

  constructor(statusCode: ContentfulStatusCode, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
