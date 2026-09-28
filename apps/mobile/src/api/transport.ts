import { apiErrorResponseSchema, type ApiErrorResponse } from '@xiaotidu/contracts';

import { SessionContext, type SessionSnapshot } from './sessionContext';

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
  // 仅撤销已退出的远端会话使用，不触发当前会话刷新或登出。
  detachedSession?: boolean;
  token?: null | string;
};

type ApiSuccessResponse<T> = { data: T };

export type ApiTransportOptions = {
  baseUrl: string | (() => string);
  delay?: (milliseconds: number) => Promise<void>;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
  sessions?: SessionContext;
};

export class ApiTransport {
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly fetchImplementation: typeof fetch;
  private readonly sessions: SessionContext;
  private refresh: { generation: number; promise: Promise<string | null> } | null = null;
  private sessionRefreshHandler: ((session: SessionSnapshot) => Promise<string | null>) | null = null;
  private readonly timeoutMs: number;
  private unauthorizedHandler: ((session: SessionSnapshot) => void) | null = null;

  constructor(private readonly options: ApiTransportOptions) {
    this.delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sessions = options.sessions ?? new SessionContext();
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async request<T>(path: string, schema: RuntimeSchema<T>, options: ApiRequestOptions = {}): Promise<T> {
    const session = options.token && !options.detachedSession ? this.sessions.capture(options.token) : null;
    return this.requestAttempt(path, schema, options, 0, false, session);
  }

  setSessionRefreshHandler(handler: ((session: SessionSnapshot) => Promise<string | null>) | null) {
    this.sessionRefreshHandler = handler;
    this.refresh = null;
  }

  setUnauthorizedHandler(handler: ((session: SessionSnapshot) => void) | null) {
    this.unauthorizedHandler = handler;
  }

  private async requestAttempt<T>(
    path: string,
    schema: RuntimeSchema<T>,
    options: ApiRequestOptions,
    retryCount: number,
    didRefresh: boolean,
    session: SessionSnapshot | null,
  ): Promise<T> {
    if (session) this.sessions.assertCurrent(session);
    if (options.signal?.aborted) {
      throw new ApiClientError(0, 'cancelled', '请求已取消。');
    }

    const sentToken = session ? this.sessions.current()!.accessToken : options.token;
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
          ...(options.token ? { authorization: `Bearer ${sentToken}` } : {}),
        },
        method: options.method ?? 'GET',
        signal: controller.signal,
      });
    } catch {
      if (session) this.sessions.assertCurrent(session);
      const method = options.method ?? 'GET';
      const parentAborted = options.signal?.aborted === true;
      if (!parentAborted && retryCount === 0 && (method === 'GET' || method === 'PUT')) {
        await this.delay(250);
        return this.requestAttempt(path, schema, options, retryCount + 1, didRefresh, session);
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

    if (session) this.sessions.assertCurrent(session);
    const text = await response.text();
    if (session) this.sessions.assertCurrent(session);
    if (options.signal?.aborted) throw new ApiClientError(0, 'cancelled', '请求已取消。');
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiClientError(response.status, 'invalid_response', '服务返回了无法识别的数据。');
    }

    if (!response.ok) {
      const parsedError = apiErrorResponseSchema.safeParse(parsed);
      const error: ApiErrorResponse | null = parsedError.success ? parsedError.data : null;
      if (
        response.status === 401 &&
        error?.error.code === 'unauthorized' &&
        session &&
        options.allowAuthRefresh !== false &&
        !didRefresh &&
        this.sessionRefreshHandler
      ) {
        const nextToken = await this.refreshAccessToken({ ...session, accessToken: sentToken! });
        this.sessions.assertCurrent(session);
        if (nextToken)
          return this.requestAttempt(path, schema, { ...options, token: nextToken }, retryCount, true, session);
      }

      if (
        response.status === 401 &&
        error?.error.code === 'unauthorized' &&
        session &&
        this.sessions.current()?.accessToken === sentToken
      )
        this.unauthorizedHandler?.(session);
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

  private refreshAccessToken(session: SessionSnapshot) {
    this.sessions.assertCurrent(session);
    if (!this.sessionRefreshHandler) return Promise.resolve(null);
    // 延迟的 401 可直接使用同一会话已经轮换的 token。
    const current = this.sessions.current()!;
    if (current.accessToken !== session.accessToken) return Promise.resolve(current.accessToken);
    if (this.refresh?.generation === session.generation) return this.refresh.promise;
    const handler = this.sessionRefreshHandler;
    const pending = {
      generation: session.generation,
      promise: Promise.resolve().then(() => {
        this.sessions.assertCurrent(session);
        return handler(session);
      }),
    };
    this.refresh = pending;
    pending.promise = pending.promise.finally(() => {
      if (this.refresh === pending) this.refresh = null;
    });
    return pending.promise;
  }
}
