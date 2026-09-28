import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppleSignInFlow } from '../appleSignInFlow';

const nonce = '12345678-1234-1234-1234-123456789012';
const state = '87654321-4321-4321-4321-210987654321';
const dependencies = {
  isAvailable: vi.fn(),
  createRandomValue: vi.fn(),
  signIn: vi.fn(),
  captureGeneration: vi.fn(),
  isGenerationCurrent: vi.fn(),
  authenticate: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  dependencies.isAvailable.mockResolvedValue(true);
  dependencies.createRandomValue.mockReturnValueOnce(nonce).mockReturnValueOnce(state);
  dependencies.captureGeneration.mockReturnValue(3);
  dependencies.isGenerationCurrent.mockReturnValue(true);
  dependencies.signIn.mockResolvedValue({ identityToken: 'signed-token', state, nickname: ' 用户 ' });
  dependencies.authenticate.mockResolvedValue(true);
});

describe('native Apple login orchestration', () => {
  it('sends a token and its nonce only after the native authorization completes', async () => {
    let finish!: (value: unknown) => void;
    dependencies.signIn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const flow = createAppleSignInFlow(dependencies);
    const pending = flow();
    await vi.waitFor(() => expect(dependencies.signIn).toHaveBeenCalledWith({ nonce, state }));
    expect(dependencies.authenticate).not.toHaveBeenCalled();
    expect(await flow()).toBe('busy');
    finish({ identityToken: 'signed-token', state, nickname: ' 用户 ' });
    expect(await pending).toBe('signed_in');
    expect(dependencies.authenticate).toHaveBeenCalledExactlyOnceWith({
      identityToken: 'signed-token',
      nonce,
      nickname: '用户',
    });
  });
  it('treats cancellation as a no-op and permits the next attempt', async () => {
    dependencies.signIn.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    const flow = createAppleSignInFlow(dependencies);
    expect(await flow()).toBe('cancelled');
    expect(dependencies.authenticate).not.toHaveBeenCalled();
    dependencies.createRandomValue.mockReturnValueOnce(nonce).mockReturnValueOnce(state);
    expect(await flow()).toBe('signed_in');
  });
  it('does not overwrite a saved nickname when Apple omits the name on later logins', async () => {
    dependencies.signIn.mockResolvedValue({ identityToken: 'signed-token', state });
    expect(await createAppleSignInFlow(dependencies)()).toBe('signed_in');
    expect(dependencies.authenticate).toHaveBeenCalledWith({ identityToken: 'signed-token', nonce });
  });
  it.each([
    { identityToken: null, state },
    { identityToken: '  ', state },
    { identityToken: 'signed-token', state: 'another-request' },
  ])('rejects incomplete or mismatched native responses', async (credential) => {
    dependencies.signIn.mockResolvedValue(credential);
    await expect(createAppleSignInFlow(dependencies)()).rejects.toThrow('Apple 登录验证未完成');
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });
  it('keeps unsupported platforms local-only', async () => {
    dependencies.isAvailable.mockResolvedValue(false);
    expect(await createAppleSignInFlow(dependencies)()).toBe('unavailable');
    expect(dependencies.signIn).not.toHaveBeenCalled();
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });
  it.each(['account', 'screen'])('discards authorization after the %s changes', async (reason) => {
    let active = true;
    dependencies.signIn.mockImplementation(async () => {
      if (reason === 'account') dependencies.isGenerationCurrent.mockReturnValue(false);
      else active = false;
      return { identityToken: 'signed-token', state };
    });
    expect(await createAppleSignInFlow(dependencies)(() => active)).toBe('stale');
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });
  it('does not report success when the API rejects the login', async () => {
    dependencies.authenticate.mockResolvedValue(false);
    expect(await createAppleSignInFlow(dependencies)()).toBe('failed');
  });
  it('propagates native errors without trying another login identity', async () => {
    dependencies.signIn.mockRejectedValue(new Error('native failure'));
    await expect(createAppleSignInFlow(dependencies)()).rejects.toThrow('native failure');
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });
});
