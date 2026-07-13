import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, ApiTransport, type RuntimeSchema } from '../transport';

const valueSchema: RuntimeSchema<string> = {
  parse(value) {
    if (typeof value !== 'string') throw new Error('invalid');
    return value;
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ApiTransport', () => {
  it('retries GET once after a network failure', async () => {
    const fetchImplementation = vi.fn().mockRejectedValue(new Error('offline'));
    const transport = createTransport(fetchImplementation);

    await expect(transport.request('/health', valueSchema)).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('does not retry a creating POST request', async () => {
    const fetchImplementation = vi.fn().mockRejectedValue(new Error('offline'));
    const transport = createTransport(fetchImplementation);

    await expect(transport.request('/nudges', valueSchema, { method: 'POST' })).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('retries an idempotent PUT once and returns the second response', async () => {
    const fetchImplementation = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse({ data: 'updated' }));
    const transport = createTransport(fetchImplementation);

    await expect(transport.request('/share-settings', valueSchema, { method: 'PUT' })).resolves.toBe('updated');
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('classifies timeout and pre-cancelled requests without retrying POST', async () => {
    vi.useFakeTimers();
    const hangingFetch = vi.fn((_input: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    });
    const transport = createTransport(hangingFetch, 10);
    const timeoutRequest = transport.request('/nudges', valueSchema, { method: 'POST' });
    const timeoutExpectation = expect(timeoutRequest).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(10);
    await timeoutExpectation;

    const controller = new AbortController();
    controller.abort();
    const cancelledFetch = vi.fn().mockRejectedValue(new Error('aborted'));
    const cancelledTransport = createTransport(cancelledFetch);
    await expect(
      cancelledTransport.request('/nudges', valueSchema, { method: 'POST', signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(cancelledFetch).not.toHaveBeenCalled();

    const activeController = new AbortController();
    const activeCancellation = transport.request('/health', valueSchema, { signal: activeController.signal });
    const cancellationExpectation = expect(activeCancellation).rejects.toMatchObject({ code: 'cancelled' });
    activeController.abort();
    await cancellationExpectation;
    expect(hangingFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid JSON and schema-incompatible success data', async () => {
    const invalidJsonTransport = createTransport(vi.fn().mockResolvedValue(new Response('{', { status: 200 })));
    await expect(invalidJsonTransport.request('/health', valueSchema)).rejects.toMatchObject({
      code: 'invalid_response',
    });

    const invalidDataTransport = createTransport(
      vi.fn().mockResolvedValue(jsonResponse({ data: { unexpected: true } })),
    );
    await expect(invalidDataTransport.request('/health', valueSchema)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('shares one refresh across concurrent 401 responses and retries each request once', async () => {
    let releaseRefresh: ((token: string | null) => void) | undefined;
    const refreshResult = new Promise<string | null>((resolve) => {
      releaseRefresh = resolve;
    });
    const refreshHandler = vi.fn(() => refreshResult);
    const fetchImplementation = vi.fn((_input: URL | RequestInfo, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('authorization');
      return Promise.resolve(
        authorization === 'Bearer fresh-token'
          ? jsonResponse({ data: 'ok' })
          : jsonResponse({ error: { code: 'unauthorized', message: 'expired' } }, 401),
      );
    });
    const transport = createTransport(fetchImplementation);
    transport.setSessionRefreshHandler(refreshHandler);

    const first = transport.request('/me', valueSchema, { token: 'expired-token' });
    const second = transport.request('/team', valueSchema, { token: 'expired-token' });
    await vi.waitFor(() => expect(refreshHandler).toHaveBeenCalledTimes(1));
    releaseRefresh?.('fresh-token');

    await expect(Promise.all([first, second])).resolves.toEqual(['ok', 'ok']);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });

  it('clears authorization through the unauthorized handler when refresh fails', async () => {
    const transport = createTransport(
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: 'expired' } }, 401)),
    );
    const refreshHandler = vi.fn().mockResolvedValue(null);
    const unauthorizedHandler = vi.fn();
    transport.setSessionRefreshHandler(refreshHandler);
    transport.setUnauthorizedHandler(unauthorizedHandler);

    await expect(transport.request('/me', valueSchema, { token: 'expired-token' })).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
  });
});

function createTransport(fetchImplementation: typeof fetch, timeoutMs = 100) {
  return new ApiTransport({
    baseUrl: 'https://api.example.test',
    delay: async () => undefined,
    fetchImplementation,
    timeoutMs,
  });
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}
