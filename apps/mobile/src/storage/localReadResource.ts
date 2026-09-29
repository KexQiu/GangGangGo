import { authSessionContext, SessionChangedError } from '../api/sessionContext';

export type LocalReadState<T> = {
  data: T | null;
  error: string | null;
  phase: 'loading' | 'error' | 'empty' | 'ready';
  generation: number | null;
  key: string | null;
};

/** 本地查询共用写入队列；只发布当前资料、当前请求的结果。 */
export class LocalReadResource<T> {
  private request = 0;
  private listeners = new Set<() => void>();
  private state: LocalReadState<T> = this.initialState();

  constructor(private readonly isEmpty: (data: T) => boolean = () => false) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  reset() {
    this.request += 1;
    this.publish(this.initialState());
  }

  cancel() {
    this.request += 1;
  }

  async load(key: string, read: () => Promise<T>) {
    const request = ++this.request;
    const generation = authSessionContext.getGeneration();
    try {
      authSessionContext.captureLocalGeneration();
    } catch {
      this.publish({ key, generation, data: null, phase: 'error', error: '账号资料尚未恢复，请稍后重试。' });
      return;
    }
    const previous = this.state.key === key && this.state.generation === generation ? this.state.data : null;
    this.publish({ key, generation, data: previous, phase: 'loading', error: null });
    try {
      const data = await authSessionContext.runExclusive(generation, async () => {
        const value = await read();
        authSessionContext.assertGeneration(generation);
        return value;
      });
      if (request !== this.request) return;
      authSessionContext.assertGeneration(generation);
      this.publish({ key, generation, data, phase: this.isEmpty(data) ? 'empty' : 'ready', error: null });
    } catch (error) {
      if (request !== this.request) return;
      if (error instanceof SessionChangedError || !authSessionContext.isGenerationCurrent(generation)) {
        this.reset();
        return;
      }
      this.publish({
        key,
        generation,
        data: previous,
        phase: 'error',
        error: error instanceof Error ? error.message : '本地数据读取失败，请重试。',
      });
    }
  }

  private publish(state: LocalReadState<T>) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private initialState(): LocalReadState<T> {
    return { data: null, error: null, phase: 'loading', key: null, generation: null };
  }
}
