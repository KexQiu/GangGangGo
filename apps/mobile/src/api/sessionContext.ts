export type SessionSnapshot = Readonly<{
  generation: number;
  userId: string;
  profileId: string;
  accessToken: string;
}>;

export class SessionChangedError extends Error {
  readonly code = 'session_changed';

  constructor() {
    super('账号已切换，请重新操作。');
    this.name = 'SessionChangedError';
  }
}

/** 身份变更递增代次；同一身份的 token 轮换不改变代次。 */
export class SessionContext {
  private generation = 0;
  private session: SessionSnapshot | null = null;
  private tokens = new Set<string>();
  private effects: Promise<unknown> = Promise.resolve();

  beginTransition() {
    this.generation += 1;
    this.session = null;
    this.tokens.clear();
    return this.generation;
  }

  isGenerationCurrent(generation: number) {
    return generation === this.generation;
  }

  assertGeneration(generation: number) {
    if (!this.isGenerationCurrent(generation)) throw new SessionChangedError();
  }

  activate(session: SessionSnapshot) {
    this.assertGeneration(session.generation);
    if (this.session && (this.session.userId !== session.userId || this.session.profileId !== session.profileId)) {
      throw new SessionChangedError();
    }
    this.session = Object.freeze({ ...session });
    this.tokens.add(session.accessToken);
  }

  current() {
    return this.session;
  }

  capture(token: string) {
    if (!this.session || !this.tokens.has(token)) throw new SessionChangedError();
    return this.session;
  }

  assertCurrent(session: SessionSnapshot) {
    if (
      !this.session ||
      session.generation !== this.session.generation ||
      session.userId !== this.session.userId ||
      session.profileId !== this.session.profileId
    ) {
      throw new SessionChangedError();
    }
  }

  /** 只串行本地副作用，网络请求不占锁，旧网络请求不能阻塞换号。 */
  runExclusive<T>(generation: number, effect: () => Promise<T>): Promise<T> {
    const result = this.effects.then(async () => {
      this.assertGeneration(generation);
      return effect();
    });
    this.effects = result.catch(() => undefined);
    return result;
  }
}

export const authSessionContext = new SessionContext();
