export type SyncReason = 'app_boot' | 'app_foreground' | 'auth_changed' | 'local_changed' | 'pro_changed';

export type SyncAppState = 'active' | 'background' | 'inactive' | 'unknown';

type AuthSnapshot = {
  accessToken: string | null;
  refreshEntitlements: () => Promise<unknown>;
};

type AuthChange = {
  accessTokenChanged: boolean;
  proStatusChanged: boolean;
};

type Unsubscribe = () => void;

export type SyncCoordinatorDependencies = {
  debounceMs?: number;
  getAppState: () => SyncAppState;
  getAuth: () => AuthSnapshot;
  registerPushToken: () => Promise<unknown>;
  subscribeAppState: (listener: (state: SyncAppState) => void) => Unsubscribe;
  subscribeAuthChanges: (listener: (change: AuthChange) => void) => Unsubscribe;
  subscribeLocalChanges: (listener: () => void) => Unsubscribe;
  syncReports: () => Promise<unknown>;
  syncShareSnapshot: () => Promise<unknown>;
  syncWatch: (now: Date, reason: string) => Promise<unknown>;
};

export class SyncCoordinator {
  private appState: SyncAppState;
  private readonly debounceMs: number;
  private pendingReasons = new Set<SyncReason>();
  private running = false;
  private started = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Unsubscribe[] = [];

  constructor(private readonly dependencies: SyncCoordinatorDependencies) {
    this.appState = dependencies.getAppState();
    this.debounceMs = dependencies.debounceMs ?? 750;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.appState = this.dependencies.getAppState();
    this.unsubscribers.push(
      this.dependencies.subscribeAuthChanges((change) => {
        if (change.accessTokenChanged) this.schedule('auth_changed', true);
        if (change.proStatusChanged) this.schedule('pro_changed');
      }),
      this.dependencies.subscribeLocalChanges(() => this.schedule('local_changed')),
      this.dependencies.subscribeAppState((nextState) => {
        const wasInactive = this.appState !== 'active';
        this.appState = nextState;
        if (wasInactive && nextState === 'active') this.schedule('app_foreground', true);
      }),
    );
    this.schedule('app_boot', true);
  }

  stop() {
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pendingReasons.clear();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
  }

  schedule(reason: SyncReason, immediate = false) {
    this.pendingReasons.add(reason);
    if (this.running) return;
    this.armTimer(immediate ? 0 : this.debounceMs);
  }

  private armTimer(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  private async flush() {
    this.timer = null;
    if (this.running || this.appState !== 'active') return;

    this.running = true;
    const reasons = new Set(this.pendingReasons);
    this.pendingReasons.clear();
    const auth = this.dependencies.getAuth();
    const reason = [...reasons].join(',');
    const tasks: Array<() => Promise<unknown>> = [() => this.dependencies.syncWatch(new Date(), reason)];

    if (auth.accessToken) {
      if ([...reasons].some((item) => item !== 'local_changed' && item !== 'pro_changed')) {
        tasks.push(() => auth.refreshEntitlements());
      }
      tasks.push(
        () => this.dependencies.syncShareSnapshot(),
        () => this.dependencies.syncReports(),
        () => this.dependencies.registerPushToken(),
      );
    }

    try {
      await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)));
    } finally {
      this.running = false;
      if (this.started && this.pendingReasons.size > 0) this.armTimer(this.debounceMs);
    }
  }
}
