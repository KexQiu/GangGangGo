import { apiErrorResponseSchema, type ApiErrorResponse } from '@xiaotidu/contracts';

export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export type RuntimeSchema<T> = { parse: (value: unknown) => T };

export type ApiRequestOptions = {
  allowAuthRefresh?: boolean;
  body?: unknown;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  signal?: AbortSignal;
  token?: null | string;
};

type ApiSuccessResponse<T> = { data: T };

export type ApiTransportOptions = {
  baseUrl: string | (() => string);
  delay?: (milliseconds: number) => Promise<void>;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
};

export class ApiTransport {
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly fetchImplementation: typeof fetch;
  private refreshPromise: Promise<string | null> | null = null;
  private sessionRefreshHandler: (() => Promise<string | null>) | null = null;
  private readonly timeoutMs: number;
  private unauthorizedHandler: (() => void) | null = null;

  constructor(private readonly options: ApiTransportOptions) {
    this.delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  request<T>(path: string, schema: RuntimeSchema<T>, options: ApiRequestOptions = {}): Promise<T> {
    return this.requestAttempt(path, schema, options, 0, false);
  }

  setSessionRefreshHandler(handler: (() => Promise<string | null>) | null) {
    this.sessionRefreshHandler = handler;
    this.refreshPromise = null;
  }

  setUnauthorizedHandler(handler: (() => void) | null) {
    this.unauthorizedHandler = handler;
  }

  private async requestAttempt<T>(
    path: string,
    schema: RuntimeSchema<T>,
    options: ApiRequestOptions,
    retryCount: number,
    didRefresh: boolean,
  ): Promise<T> {
    if (options.signal?.aborted) {
      throw new ApiClientError(0, 'cancelled', '请求已取消。');
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const abortFromParent = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromParent, { once: true });
    let response: Response;

    try {
      const baseUrl = typeof this.options.baseUrl === 'function' ? this.options.baseUrl() : this.options.baseUrl;
      response = await this.fetchImplementation(`${baseUrl}${path}`, {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers: {
          accept: 'application/json',
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
        method: options.method ?? 'GET',
        signal: controller.signal,
      });
    } catch {
      const method = options.method ?? 'GET';
      const parentAborted = options.signal?.aborted === true;
      if (!parentAborted && retryCount === 0 && (method === 'GET' || method === 'PUT')) {
        await this.delay(250);
        return this.requestAttempt(path, schema, options, retryCount + 1, didRefresh);
      }
      throw new ApiClientError(
        0,
        parentAborted ? 'cancelled' : timedOut ? 'timeout' : 'network_error',
        parentAborted ? '请求已取消。' : timedOut ? '请求超时，请稍后再试。' : '网络连接失败。',
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromParent);
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiClientError(response.status, 'invalid_response', '服务返回了无法识别的数据。');
    }

    if (!response.ok) {
      if (
        response.status === 401 &&
        options.token &&
        options.allowAuthRefresh !== false &&
        !didRefresh &&
        this.sessionRefreshHandler
      ) {
        const nextToken = await this.refreshAccessToken();
        if (nextToken) return this.requestAttempt(path, schema, { ...options, token: nextToken }, retryCount, true);
      }

      const parsedError = apiErrorResponseSchema.safeParse(parsed);
      const error: ApiErrorResponse | null = parsedError.success ? parsedError.data : null;
      if (response.status === 401 && options.token) this.unauthorizedHandler?.();
      throw new ApiClientError(
        response.status,
        error?.error.code ?? 'internal_error',
        error?.error.message ?? '请求失败了，稍后再试。',
        error?.error.details,
      );
    }

    try {
      return schema.parse((parsed as ApiSuccessResponse<unknown>).data);
    } catch {
      throw new ApiClientError(response.status, 'invalid_response', '服务返回的数据不符合约定。');
    }
  }

  private refreshAccessToken() {
    if (!this.sessionRefreshHandler) return Promise.resolve(null);
    this.refreshPromise ??= Promise.resolve()
      .then(this.sessionRefreshHandler)
      .catch(() => null)
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }
}
