export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    details?: unknown;
    message: string;
  };
};

export function toSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}

export function toErrorResponse(code: string, message: string, details?: unknown): ApiErrorResponse {
  return {
    error: {
      code,
      ...(details === undefined ? {} : { details }),
      message,
    },
  };
}
