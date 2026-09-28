import { describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../sessionContext';
import { ApiClientError, ApiTransport } from '../transport';

const schema = { parse: (value: unknown) => value };
const unauthorized = () => json({ error: { code: 'unauthorized', message: 'expired' } }, 401);

describe('HTTP request ownership', () => {
  it.each([200, 401, 500])('discards an old %s response after switching accounts', async (status) => {
    const { sessions, fetcher, transport, refresh, expired } = setup();
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    const request = transport.request('/data-sync/push', schema, { token: 'A', method: 'PUT', body: { owner: 'A' } });
    const result = request.catch((error) => error);
    activate(sessions, 'B');
    pending.resolve(status === 401 ? unauthorized() : json({ data: 'old' }, status));
    expect(await result).toMatchObject({ code: 'session_changed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it('does not retry a failed PUT under a new account after backoff', async () => {
    const backoff = deferred<void>();
    const delay = vi.fn(() => backoff.promise);
    const { sessions, fetcher, transport } = setup(delay);
    fetcher.mockRejectedValueOnce(new Error('offline'));
    const result = transport
      .request('/data-sync/push', schema, { token: 'A', method: 'PUT', body: { owner: 'A' } })
      .catch((error) => error);
    await vi.waitFor(() => expect(delay).toHaveBeenCalledOnce());
    activate(sessions, 'B');
    backoff.resolve();
    expect(await result).toMatchObject({ code: 'session_changed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops a request waiting for refresh when the account changes', async () => {
    const { sessions, fetcher, transport, refresh, expired } = setup();
    const refreshing = deferred<string | null>();
    fetcher.mockResolvedValue(unauthorized());
    refresh.mockReturnValue(refreshing.promise);
    const result = transport
      .request('/data-sync/push', schema, { token: 'A', method: 'PUT', body: { owner: 'A' } })
      .catch((error) => error);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    activate(sessions, 'B');
    refreshing.resolve('B');
    expect(await result).toMatchObject({ code: 'session_changed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
  });

  it('preserves refresh failure classification instead of firing unauthorized', async () => {
    const { fetcher, transport, refresh, expired } = setup();
    fetcher.mockResolvedValue(unauthorized());
    const offline = new ApiClientError(0, 'network_error', 'offline');
    refresh.mockRejectedValue(offline);
    await expect(transport.request('/me', schema, { token: 'A' })).rejects.toBe(offline);
    expect(expired).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses a token already rotated within the original session for a delayed 401', async () => {
    const { sessions, fetcher, transport, refresh } = setup();
    const first = deferred<Response>();
    fetcher.mockReturnValueOnce(first.promise).mockResolvedValueOnce(json({ data: 'ok' }));
    const request = transport.request('/data-sync/push', schema, { token: 'A', method: 'PUT', body: { owner: 'A' } });
    sessions.activate({ ...sessions.current()!, accessToken: 'A-rotated' });
    first.resolve(unauthorized());
    await expect(request).resolves.toBe('ok');
    expect(refresh).not.toHaveBeenCalled();
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer A-rotated');
    expect(fetcher.mock.calls[1][1]?.body).toBe(JSON.stringify({ owner: 'A' }));
  });

  it('rejects a token from a different owner before any network request', async () => {
    const { sessions, fetcher, transport } = setup();
    activate(sessions, 'B');
    await expect(
      transport.request('/data-sync/push', schema, { token: 'A', body: { owner: 'A' }, method: 'PUT' }),
    ).rejects.toMatchObject({ code: 'session_changed' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks ownership again after asynchronously reading the response body', async () => {
    const { sessions, fetcher, transport } = setup();
    const body = deferred<string>();
    const text = vi.fn(() => body.promise);
    fetcher.mockResolvedValue({ ok: true, status: 200, text } as unknown as Response);
    const result = transport.request('/me', schema, { token: 'A' }).catch((error) => error);
    await vi.waitFor(() => expect(text).toHaveBeenCalledOnce());
    activate(sessions, 'B');
    body.resolve(JSON.stringify({ data: 'A' }));
    expect(await result).toMatchObject({ code: 'session_changed' });
  });

  it('keeps a newer token when an already-retried request returns a late 401', async () => {
    const { sessions, fetcher, transport, refresh, expired } = setup();
    const retry = deferred<Response>();
    fetcher.mockResolvedValueOnce(unauthorized()).mockReturnValueOnce(retry.promise);
    refresh.mockImplementation(async () => {
      sessions.activate({ ...sessions.current()!, accessToken: 'A-first-rotation' });
      return 'A-first-rotation';
    });
    const result = transport.request('/me', schema, { token: 'A' }).catch((error) => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    sessions.activate({ ...sessions.current()!, accessToken: 'A-second-rotation' });
    retry.resolve(unauthorized());
    expect(await result).toMatchObject({ status: 401 });
    expect(expired).not.toHaveBeenCalled();
  });

  it('does not let A refresh completion clear B refresh single flight', async () => {
    const { sessions, fetcher, transport, refresh } = setup();
    const old = deferred<string | null>();
    const current = deferred<string | null>();
    fetcher.mockImplementation(async (_url, init) =>
      new Headers(init?.headers).get('authorization') === 'Bearer B-fresh' ? json({ data: 'B' }) : unauthorized(),
    );
    refresh.mockReturnValueOnce(old.promise).mockImplementationOnce(async () => {
      const token = await current.promise;
      sessions.activate({ ...sessions.current()!, accessToken: token! });
      return token;
    });
    const oldRequest = transport.request('/me', schema, { token: 'A' }).catch((error) => error);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    activate(sessions, 'B');
    const newRequest = transport.request('/me', schema, { token: 'B' });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    old.resolve('A-fresh');
    await oldRequest;
    const joined = transport.request('/me', schema, { token: 'B' });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    current.resolve('B-fresh');
    await expect(Promise.all([newRequest, joined])).resolves.toEqual(['B', 'B']);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('isolates detached logout from the active account', async () => {
    const { sessions, fetcher, transport, refresh, expired } = setup();
    activate(sessions, 'B');
    fetcher.mockResolvedValue(unauthorized());
    await expect(
      transport.request('/auth/logout', schema, { token: 'A', detachedSession: true, method: 'POST' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
    expect(sessions.current()?.userId).toBe('B');
  });

  it('does not treat an unrecognized 401 response as invalid credentials', async () => {
    const { fetcher, transport, refresh, expired } = setup();
    fetcher.mockResolvedValue(json({}, 401));
    await expect(transport.request('/me', schema, { token: 'A' })).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });
});

function setup(delay: () => Promise<void> = async () => undefined) {
  const sessions = new SessionContext();
  activate(sessions, 'A');
  const fetcher = vi.fn<typeof fetch>();
  const transport = new ApiTransport({
    baseUrl: 'https://api.example.test',
    sessions,
    fetchImplementation: fetcher,
    delay,
  });
  const refresh = vi.fn<() => Promise<string | null>>();
  const expired = vi.fn();
  transport.setSessionRefreshHandler(refresh);
  transport.setUnauthorizedHandler(expired);
  return { sessions, fetcher, transport, refresh, expired };
}
function activate(sessions: SessionContext, userId: string) {
  sessions.activate({
    generation: sessions.beginTransition(),
    userId,
    profileId: `profile-${userId}`,
    accessToken: userId,
  });
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
