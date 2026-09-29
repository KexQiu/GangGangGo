import type { SyncTaskResult } from './syncTaskResult';

export type SyncReason =
  'app_boot' | 'app_foreground' | 'auth_changed' | 'entitlements_changed' | 'local_changed' | 'task_retry';

export type SyncAppState = 'active' | 'background' | 'inactive' | 'unknown';
export const syncTaskNames = ['watch', 'entitlements', 'data', 'push'] as const;
export type SyncTaskName = (typeof syncTaskNames)[number];
export type SyncTaskStatus = {
  lastError: string | null;
  lastFinishedAt: string | null;
  lastSucceededAt: string | null;
  skipReason: string | null;
  phase: 'error' | 'idle' | 'running' | 'success' | 'skipped';
};
export type SyncTaskStatuses = Record<SyncTaskName, SyncTaskStatus>;

type AuthSnapshot = {
  accessToken: string | null;
  sessionKey: number | null;
  refreshEntitlements: () => Promise<SyncTaskResult>;
};

type AuthChange = {
  accessTokenChanged: boolean;
  entitlementsChanged: boolean;
};

type Unsubscribe = () => void;
type SyncTask = () => Promise<SyncTaskResult>;

export type SyncCoordinatorDependencies = {
  debounceMs?: number;
  getAppState: () => SyncAppState;
  getAuth: () => AuthSnapshot;
  syncData: SyncTask;
  registerPushToken: SyncTask;
  subscribeAppState: (listener: (state: SyncAppState) => void) => Unsubscribe;
  subscribeAuthChanges: (listener: (change: AuthChange) => void) => Unsubscribe;
  subscribeLocalChanges: (listener: () => void) => Unsubscribe;
  syncWatch: (now: Date, reason: string) => Promise<SyncTaskResult>;
};

export class SyncCoordinator {
  private appState: SyncAppState;
  private readonly debounceMs: number;
  private pendingReasons = new Set<SyncReason>();
  private pendingTaskRetries = new Set<SyncTaskName>();
  private currentRun: object | null = null;
  private epoch = 0;
  private sessionKey: number | null;
  private started = false;
  private statusListeners = new Set<(statuses: SyncTaskStatuses) => void>();
  private taskStatuses = createInitialTaskStatuses();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Unsubscribe[] = [];

  constructor(private readonly dependencies: SyncCoordinatorDependencies) {
    this.appState = dependencies.getAppState();
    this.debounceMs = dependencies.debounceMs ?? 750;
    this.sessionKey = dependencies.getAuth().sessionKey;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.appState = this.dependencies.getAppState();
    this.unsubscribers.push(
      this.dependencies.subscribeAuthChanges((change) => {
        this.refreshIdentity();
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
    this.epoch += 1;
    this.currentRun = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pendingReasons.clear();
    this.pendingTaskRetries.clear();
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
  }

  schedule(reason: SyncReason, immediate = false) {
    if (!this.started) return;
    this.pendingReasons.add(reason);
    if (this.currentRun) return;
    this.armTimer(immediate ? 0 : this.debounceMs);
  }

  getTaskStatuses(): SyncTaskStatuses {
    return cloneTaskStatuses(this.taskStatuses);
  }

  getSnapshot = () => this.taskStatuses;
  getSessionKey = () => this.sessionKey;

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
    if (!this.started || this.currentRun || this.appState !== 'active') return;

    this.refreshIdentity();
    const run = {};
    this.currentRun = run;
    const epoch = this.epoch;
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
        tasks.set('push', availableTasks.push);
      }
    }

    for (const taskName of taskRetries) {
      if (taskName !== 'watch' && !auth.accessToken) {
        this.updateTaskStatus(taskName, {
          lastError: '登录后才能重试此同步任务。',
          lastFinishedAt: new Date().toISOString(),
          lastSucceededAt: null,
          skipReason: null,
          phase: 'error',
        });
        continue;
      }
      tasks.set(taskName, availableTasks[taskName]);
    }

    try {
      await Promise.allSettled(
        [...tasks].map(([taskName, task]) => Promise.resolve().then(() => this.runTrackedTask(taskName, task, epoch))),
      );
    } finally {
      if (this.currentRun === run) {
        this.currentRun = null;
        if (this.started && this.pendingReasons.size > 0) this.armTimer(this.debounceMs);
      }
    }
  }

  private async runTrackedTask(taskName: SyncTaskName, task: SyncTask, epoch: number) {
    if (!this.isCurrent(epoch)) return;
    this.updateTaskStatus(taskName, {
      ...this.taskStatuses[taskName],
      phase: 'running',
    });
    try {
      const result = await task();
      if (!this.isCurrent(epoch)) return;
      const finishedAt = new Date().toISOString();
      this.updateTaskStatus(taskName, {
        lastError: null,
        lastFinishedAt: finishedAt,
        lastSucceededAt: result.outcome === 'success' ? finishedAt : this.taskStatuses[taskName].lastSucceededAt,
        skipReason: result.outcome === 'skipped' ? result.reason : null,
        phase: result.outcome === 'success' ? 'success' : 'skipped',
      });
      return result;
    } catch (error) {
      if (!this.isCurrent(epoch)) return;
      this.updateTaskStatus(taskName, {
        ...this.taskStatuses[taskName],
        lastError: error instanceof Error ? error.message : '同步任务失败。',
        lastFinishedAt: new Date().toISOString(),
        skipReason: null,
        phase: 'error',
      });
      throw error;
    }
  }

  private isCurrent(epoch: number) {
    return this.started && epoch === this.epoch && this.sessionKey === this.dependencies.getAuth().sessionKey;
  }

  private refreshIdentity() {
    const next = this.dependencies.getAuth().sessionKey;
    if (next === this.sessionKey) return;
    this.sessionKey = next;
    this.epoch += 1;
    this.currentRun = null;
    this.pendingTaskRetries.clear();
    this.taskStatuses = createInitialTaskStatuses();
    this.notifyStatusListeners();
  }

  private updateTaskStatus(taskName: SyncTaskName, status: SyncTaskStatus) {
    this.taskStatuses = { ...this.taskStatuses, [taskName]: status };
    this.notifyStatusListeners();
  }

  private notifyStatusListeners() {
    const snapshot = this.getTaskStatuses();
    for (const listener of this.statusListeners) {
      try {
        listener(snapshot);
      } catch {
        /* 展示订阅失败不能改变同步结果。 */
      }
    }
  }
}

function createInitialTaskStatuses(): SyncTaskStatuses {
  return Object.fromEntries(
    syncTaskNames.map((taskName) => [
      taskName,
      { lastError: null, lastFinishedAt: null, lastSucceededAt: null, skipReason: null, phase: 'idle' },
    ]),
  ) as SyncTaskStatuses;
}

function cloneTaskStatuses(statuses: SyncTaskStatuses): SyncTaskStatuses {
  return Object.fromEntries(syncTaskNames.map((taskName) => [taskName, { ...statuses[taskName] }])) as SyncTaskStatuses;
}
