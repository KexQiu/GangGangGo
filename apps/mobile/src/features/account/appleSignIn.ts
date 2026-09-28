import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { authSessionContext } from '../../api/sessionContext';
import { useAuthStore } from './authStore';
import { createAppleSignInFlow } from './appleSignInFlow';

export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export const signInWithApple = createAppleSignInFlow({
  isAvailable: isAppleSignInAvailable,
  createRandomValue: () => Crypto.randomUUID(),
  captureGeneration: () => authSessionContext.captureLocalGeneration(),
  isGenerationCurrent: (generation) => authSessionContext.isGenerationCurrent(generation),
  authenticate: (request) => useAuthStore.getState().loginWithApple(request),
  signIn: async (options) => {
    const credential = await AppleAuthentication.signInAsync({
      ...options,
      // 邮箱不参与现有账号流程，不额外请求。
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    });
    return {
      identityToken: credential.identityToken,
      state: credential.state,
      ...(credential.fullName ? { nickname: AppleAuthentication.formatFullName(credential.fullName) } : {}),
    };
  },
});
