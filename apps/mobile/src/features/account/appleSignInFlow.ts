import type { AppleLoginRequest } from '@xiaotidu/contracts';

type AppleCredential = {
  identityToken: string | null;
  state: string | null;
  nickname?: string;
};
type AppleSignInDependencies = {
  isAvailable: () => Promise<boolean>;
  createRandomValue: () => string;
  signIn: (options: { nonce: string; state: string }) => Promise<AppleCredential>;
  captureGeneration: () => number;
  isGenerationCurrent: (generation: number) => boolean;
  authenticate: (request: AppleLoginRequest) => Promise<boolean>;
};

export type AppleSignInResult = 'signed_in' | 'cancelled' | 'unavailable' | 'stale' | 'busy' | 'failed';

/** 系统授权完成前不修改本地会话；跨页面共享实例阻止并发授权。 */
export function createAppleSignInFlow(dependencies: AppleSignInDependencies) {
  let inFlight = false;
  return async (isActive: () => boolean = () => true): Promise<AppleSignInResult> => {
    if (inFlight) return 'busy';
    inFlight = true;
    try {
      const generation = dependencies.captureGeneration();
      const isCurrent = () => isActive() && dependencies.isGenerationCurrent(generation);
      if (!(await dependencies.isAvailable())) return 'unavailable';
      if (!isCurrent()) return 'stale';
      const nonce = dependencies.createRandomValue();
      const state = dependencies.createRandomValue();
      const credential = await dependencies.signIn({ nonce, state });
      if (!isCurrent()) return 'stale';
      if (!credential.identityToken?.trim() || credential.state !== state) {
        throw new Error('Apple 登录验证未完成，请重新尝试。');
      }
      const nickname = credential.nickname?.trim().slice(0, 60);
      return (await dependencies.authenticate({
        identityToken: credential.identityToken,
        nonce,
        ...(nickname ? { nickname } : {}),
      }))
        ? 'signed_in'
        : 'failed';
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
        return 'cancelled';
      }
      throw error;
    } finally {
      inFlight = false;
    }
  };
}
