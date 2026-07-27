export type SyncReason =
  'app_boot' | 'app_foreground' | 'auth_changed' | 'entitlements_changed' | 'local_changed' | 'task_retry';

export type SyncAppState = 'active' | 'background' | 'inactive' | 'unknown';
export const syncTaskNames = ['watch', 'entitlements', 'data', 'reports', 'push'] as const;
export type SyncTaskName = (typeof syncTaskNames)[number];
export type SyncTaskStatus = {
  lastError: string | null;
  lastFinishedAt: string | null;
  phase: 'error' | 'idle' | 'running' | 'success';
};
export type SyncTaskStatuses = Record<SyncTaskName, SyncTaskStatus>;

type AuthSnapshot = {
  accessToken: string | null;
  refreshEntitlements: () => Promise<unknown>;
};

type AuthChange = {
  accessTokenChanged: boolean;
  entitlementsChanged: boolean;
};

type Unsubscribe = () => void;
type SyncTask = () => Promise<unknown>;

export type SyncCoordinatorDependencies = {
  debounceMs?: number;
  getAppState: () => SyncAppState;
  getAuth: () => AuthSnapshot;
  syncData: () => Promise<unknown>;
  registerPushToken: () => Promise<unknown>;
  subscribeAppState: (listener: (state: SyncAppState) => void) => Unsubscribe;
  subscribeAuthChanges: (listener: (change: AuthChange) => void) => Unsubscribe;
  subscribeLocalChanges: (listener: () => void) => Unsubscribe;
  syncReports: () => Promise<unknown>;
  syncWatch: (now: Date, reason: string) => Promise<unknown>;
};

export class SyncCoordinator {
  private appState: SyncAppState;
  private readonly debounceMs: number;
  private pendingReasons = new Set<SyncReason>();
  private pendingTaskRetries = new Set<SyncTaskName>();
  private running = false;
  private started = false;
  private statusListeners = new Set<(statuses: SyncTaskStatuses) => void>();
  private taskStatuses = createInitialTaskStatuses();
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
        if (change.entitlementsChanged) this.schedule('entitlements_changed');
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
    this.pendingTaskRetries.clear();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
  }

  schedule(reason: SyncReason, immediate = false) {
    this.pendingReasons.add(reason);
    if (this.running) return;
    this.armTimer(immediate ? 0 : this.debounceMs);
  }

  getTaskStatuses(): SyncTaskStatuses {
    return cloneTaskStatuses(this.taskStatuses);
  }

  retryTask(taskName: SyncTaskName) {
    this.pendingTaskRetries.add(taskName);
    this.schedule('task_retry', true);
  }

  subscribeTaskStatuses(listener: (statuses: SyncTaskStatuses) => void): Unsubscribe {
    this.statusListeners.add(listener);
    listener(this.getTaskStatuses());
    return () => this.statusListeners.delete(listener);
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
    const taskRetries = new Set(this.pendingTaskRetries);
    this.pendingTaskRetries.clear();
    const auth = this.dependencies.getAuth();
    const reason = [...reasons].join(',');
    const availableTasks: Record<SyncTaskName, SyncTask> = {
      entitlements: () => auth.refreshEntitlements(),
      data: () => this.dependencies.syncData(),
      push: () => this.dependencies.registerPushToken(),
      reports: () => this.dependencies.syncReports(),
      watch: () => this.dependencies.syncWatch(new Date(), reason),
    };
    const tasks = new Map<SyncTaskName, SyncTask>();
    const shouldRunRegularSync = [...reasons].some((item) => item !== 'task_retry');

    if (shouldRunRegularSync) {
      tasks.set('watch', availableTasks.watch);
      if (auth.accessToken) {
        if ([...reasons].some((item) => item !== 'local_changed' && item !== 'entitlements_changed')) {
          tasks.set('entitlements', availableTasks.entitlements);
        }
        tasks.set('data', availableTasks.data);
        tasks.set('reports', availableTasks.reports);
        tasks.set('push', availableTasks.push);
      }
    }

    for (const taskName of taskRetries) {
      if (taskName !== 'watch' && !auth.accessToken) {
        this.updateTaskStatus(taskName, {
          lastError: '登录后才能重试此同步任务。',
          lastFinishedAt: new Date().toISOString(),
          phase: 'error',
        });
        continue;
      }
      tasks.set(taskName, availableTasks[taskName]);
    }

    try {
      await Promise.allSettled(
        [...tasks].map(([taskName, task]) => Promise.resolve().then(() => this.runTrackedTask(taskName, task))),
      );
    } finally {
      this.running = false;
      if (this.started && this.pendingReasons.size > 0) this.armTimer(this.debounceMs);
    }
  }

  private async runTrackedTask(taskName: SyncTaskName, task: SyncTask) {
    this.updateTaskStatus(taskName, {
      ...this.taskStatuses[taskName],
      phase: 'running',
    });
    try {
      const result = await task();
      this.updateTaskStatus(taskName, {
        lastError: null,
        lastFinishedAt: new Date().toISOString(),
        phase: 'success',
      });
      return result;
    } catch (error) {
      this.updateTaskStatus(taskName, {
        lastError: error instanceof Error ? error.message : '同步任务失败。',
        lastFinishedAt: new Date().toISOString(),
        phase: 'error',
      });
      throw error;
    }
  }

  private updateTaskStatus(taskName: SyncTaskName, status: SyncTaskStatus) {
    this.taskStatuses = { ...this.taskStatuses, [taskName]: status };
    const snapshot = this.getTaskStatuses();
    for (const listener of this.statusListeners) listener(snapshot);
  }
}

function createInitialTaskStatuses(): SyncTaskStatuses {
  return Object.fromEntries(
    syncTaskNames.map((taskName) => [taskName, { lastError: null, lastFinishedAt: null, phase: 'idle' }]),
  ) as SyncTaskStatuses;
}

function cloneTaskStatuses(statuses: SyncTaskStatuses): SyncTaskStatuses {
  return Object.fromEntries(syncTaskNames.map((taskName) => [taskName, { ...statuses[taskName] }])) as SyncTaskStatuses;
}
