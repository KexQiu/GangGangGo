import { beforeEach, describe, expect, it } from 'vitest';
import { authSessionContext } from '../../api/sessionContext';
import { LocalReadResource } from '../localReadResource';

beforeEach(() => authSessionContext.completeAnonymousTransition(authSessionContext.beginTransition()));

describe('local read recovery and request ownership', () => {
  it('shows an actionable error rather than endless loading if account restoration is incomplete', async () => {
    const reader = new LocalReadResource<string>();
    const generation = authSessionContext.beginTransition();
    await reader.load('overview', async () => 'must not publish');
    expect(reader.getSnapshot()).toMatchObject({ generation, phase: 'error', data: null });
    authSessionContext.completeAnonymousTransition(generation);
    await reader.load('overview', async () => 'restored');
    expect(reader.getSnapshot()).toMatchObject({ phase: 'ready', data: 'restored', error: null });
  });
  it('distinguishes first read failure, retry and a genuinely empty result', async () => {
    const reader = new LocalReadResource<string[]>((rows) => rows.length === 0);
    await reader.load('overview', async () => {
      throw new Error('SQLite unavailable');
    });
    expect(reader.getSnapshot()).toMatchObject({ phase: 'error', data: null, error: 'SQLite unavailable' });
    await reader.load('overview', async () => []);
    expect(reader.getSnapshot()).toMatchObject({ phase: 'empty', data: [], error: null });
  });

  it('keeps last successful data while refreshing or failing in the same profile', async () => {
    const reader = new LocalReadResource<number[]>();
    await reader.load('day-1', async () => [4]);
    const pending = deferred<number[]>();
    const refreshing = reader.load('day-1', () => pending.promise);
    expect(reader.getSnapshot()).toMatchObject({ phase: 'loading', data: [4] });
    pending.reject(new Error('disk failed'));
    await refreshing;
    expect(reader.getSnapshot()).toMatchObject({ phase: 'error', data: [4] });
    await reader.load('day-1', async () => [5]);
    expect(reader.getSnapshot()).toMatchObject({ phase: 'ready', data: [5], error: null });
  });

  it('does not show an earlier date while another date loads or fails', async () => {
    const reader = new LocalReadResource<string>();
    await reader.load('day-1', async () => 'first');
    await reader.load('day-2', async () => {
      throw new Error('read failed');
    });
    expect(reader.getSnapshot()).toMatchObject({ key: 'day-2', phase: 'error', data: null });
  });

  it('ignores older success and failure after a newer request starts', async () => {
    for (const fail of [false, true]) {
      const reader = new LocalReadResource<string>();
      const old = deferred<string>();
      const first = reader.load('day-1', () => old.promise);
      await Promise.resolve();
      const next = reader.load('day-2', async () => 'new');
      if (fail) old.reject(new Error('old failure'));
      else old.resolve('old');
      await Promise.all([first, next]);
      expect(reader.getSnapshot()).toMatchObject({ key: 'day-2', data: 'new', phase: 'ready', error: null });
    }
  });

  it('does not publish an old profile result even before the view receives the account change', async () => {
    const reader = new LocalReadResource<string>();
    const pending = deferred<string>();
    const loading = reader.load('overview', () => pending.promise);
    await Promise.resolve();
    authSessionContext.completeAnonymousTransition(authSessionContext.beginTransition());
    pending.resolve('old health data');
    await loading;
    expect(reader.getSnapshot().data).toBeNull();
    await reader.load('overview', async () => 'new health data');
    expect(reader.getSnapshot().data).toBe('new health data');
  });

  it('clears previous profile data immediately on a new generation read', async () => {
    const reader = new LocalReadResource<string>();
    await reader.load('overview', async () => 'old');
    authSessionContext.completeAnonymousTransition(authSessionContext.beginTransition());
    const pending = deferred<string>();
    const loading = reader.load('overview', () => pending.promise);
    expect(reader.getSnapshot().data).toBeNull();
    pending.resolve('new');
    await loading;
  });

  it('does not reopen closed detail or update a blurred view', async () => {
    const reader = new LocalReadResource<string>();
    const pending = deferred<string>();
    const loading = reader.load('day', () => pending.promise);
    reader.reset();
    pending.resolve('late');
    await loading;
    expect(reader.getSnapshot()).toMatchObject({ key: null, data: null });
    const second = reader.load('day', async () => 'cancelled');
    reader.cancel();
    await second;
    expect(reader.getSnapshot().data).toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
