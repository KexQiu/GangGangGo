# 小提督 v0.2 Apple Watch 开发计划

版本：v0.2
日期：2026-06-16
阶段：开发联调中
关联文档：[Apple Watch 需求文档](./apple-watch-prd.md)、[v0.2 开发方案](./development-plan.md)

## 1. 开发目标

在现有 Expo + iOS 原生工程基础上新增 watchOS App，让 Pro 用户可以在 Apple Watch 上完成高频轻量操作：

- 查看今日状态。
- 做菊花抬训练。
- 快速打卡小账本达标。
- 查看蹲会儿计时并快速收工。
- 通过 WatchConnectivity 与 iPhone 同步。

本计划采用 **原生 SwiftUI watchOS target + iPhone 端原生桥接/服务层**。移动端 React Native 继续作为 iPhone 主界面；Watch 端不使用 React Native。

## 2. 工程策略

### 2.1 目标结构

预计新增：

```text
apps/mobile/ios/
  XiaoTiduWatchApp/
    XiaoTiduWatchApp.swift
    Views/
      WatchHomeView.swift
      WatchTrainingModeView.swift
      WatchTrainingSessionView.swift
      WatchHabitsView.swift
      WatchToiletView.swift
      WatchEmptyStateView.swift
    Models/
      WatchTodayState.swift
      WatchEvent.swift
      WatchTrainingMode.swift
      WatchToiletStage.swift
    Services/
      WatchSessionManager.swift
      WatchEventQueue.swift
      WatchHaptics.swift
    Complications/
      XiaoTiduComplicationBundle.swift
      TodayStatusWidget.swift

  app/
    WatchConnectivityManager.swift
    WatchConnectivityModule.swift
```

Xcode target：

- `XiaoTiduWatchApp`：watchOS App。
- `XiaoTiduWatchAppExtension` 或 watchOS extension target，按 Xcode 当前 watchOS 模板生成。

注意：

- 需要 Apple Developer Program 和签名能力才能完整真机测试。
- 模拟器可用于基础 UI 与通信调试，但震动和真实配对体验必须真机验收。

### 2.2 不改动范围

本阶段不重写现有 Expo App。

不改：

- v0.1 本地 SQLite schema。
- 现有菊花抬、蹲会儿、小账本业务规则。
- 后端 API。
- Pro 订阅校验逻辑。

需要新增：

- iPhone 端 WatchConnectivity 桥接。
- Watch 端本地状态缓存与事件队列。
- React Native 端 watch 同步服务。

### 2.3 当前执行状态

代码已从功能骨架推进到 Pro 用户闭环可验收阶段：

- `XiaoTiduWatchApp`、`XiaoTiduWatchComplications` target 已接入 Xcode 工程，Watch App 随 iPhone `app` target 嵌入。
- iPhone 端 `WatchConnectivityModule` 支持激活 `WCSession`、读取配对/可达状态、发送 `WatchTodayState`、接收 Watch 消息并回 ACK。
- `WatchTodayState` 已由 iPhone TypeScript 侧统一构建，包含账号、Pro 状态、今日训练、小账本、蹲会儿、待同步数量和训练模式配置。
- 同步触发顺序已收口为：刷新权益 -> 构建 `WatchTodayState` -> 同步 Watch。触发点包含 App 启动、前台恢复、登录/退出、权益刷新、进入 `/watch` 页面、本地健康记录变化和 Watch 事件 ACK。
- Pro 可用状态只认 `pro_active` 与 `pro_grace_period`。iPhone 接收 Watch 事件前统一校验登录与 Pro 状态；Watch 发送训练、小账本、蹲会儿事件前也会校验本地最新状态。
- 非 Pro / 未登录 / Pro 过期用户在 Watch 上只读展示低敏状态；蹲会儿只展示今日次数，不展示计时、暂停或阶段，也不会把旧离线事件反复回放。
- Watch 首页已收敛为数据展示即入口：Pro 用户点击菊花抬、小账本、蹲会儿状态行进入对应页面；非 Pro 用户状态行不可点击，只显示 Pro 锁定说明。
- Watch 菊花抬已支持选择新手、标准、快速模式；再次点击当前选中模式会直接开始。训练模式时长来自 iPhone 下发的 `trainingModes`，Watch 端只保留兼容 fallback。
- Watch 菊花抬计时已改为真实时间推导：`TimelineView` 负责刷新显示，`WatchTrainingSession.snapshot(at:)` 根据 `Date()` 推导阶段、剩余秒数、轮次和进度，checkpoint tick 只处理阶段 haptic 与完成事件。
- Watch 小账本支持四项达标和撤销，ACK 后立即刷新最新 `WatchTodayState`。
- Watch 蹲会儿页面可滚动，计时用 iPhone 快照加本地时间推导，0.25 秒刷新 UI；暂停、继续、收工回传 Watch 当前计算出的用时。
- Watch 蹲会儿收工会触发 iPhone 端结束计时、保存记录、结束 Live Activity，并取消阶段通知，避免灵动岛继续计时。
- Watch 蹲会儿按 5/10/15/20 分钟阶段触发不同 haptic，收工前有确认弹层，减少误触。
- Watch 离线队列保留 24 小时过期、最多 25 条、按 event id 去重；回放前用最新 `todayState.isPro` 做本地过滤，iPhone 端仍做最终校验。
- Watch -> iPhone ACK 携带最新 `WatchTodayState` 或 `stateJson`；Watch 收到后立即刷新 UI，失败时展示中文短文案并保留可重试状态。
- Complication 已接入 App Group `group.com.kex.xiaotidu.watch` 共享低敏状态，支持 circular、rectangular、inline 三种 family；状态过期时展示打开同步。
- Complication 样式已升级：圆形使用 gauge 和状态图标，矩形展示图标、标题、详情和 footnote；蹲会儿进行中显示计时状态，普通状态展示小账本完成度和菊花抬状态。
- Complication 深链已接入 `xiaotidu-watch://home` 与 `xiaotidu-watch://toilet`。Pro 用户蹲会儿进行中点击表盘进入 Watch 蹲会儿页；非 Pro 用户不提供 widget URL，相当于禁用表盘入口操作。
- iPhone `/watch` 页面已产品化：生产环境只展示连接状态、低敏今日状态和手动同步；连接诊断、最近消息、ACK、JSON、事件日志只在 `__DEV__` 展示。

已完成的本地验证：

- `pnpm --filter @xiaotidu/mobile typecheck`
- `xcodebuild -workspace apps/mobile/ios/app.xcworkspace -scheme XiaoTiduWatchApp -configuration Debug -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' CODE_SIGNING_ALLOWED=NO build`
- `git diff --check`

尚未完成：

- iPhone + Watch 配对模拟器的完整交互走查。
- 真机 Complication 添加到表盘、点击深链和系统刷新节奏验收。
- 真机 haptic 手感验收。
- StoreKit 购买、恢复订阅和真实 Apple Developer capability 闭环。

## 3. 技术选型

### 3.1 Watch 端

- SwiftUI。
- WatchConnectivity。
- WidgetKit complication。
- WatchKit haptics。
- UserDefaults / file storage 保存轻量缓存和离线事件队列。

### 3.2 iPhone 端

- Swift `WCSession` manager。
- React Native bridge module 暴露 Watch 状态同步方法。
- TypeScript watch sync service 从现有本地 store 计算 `WatchTodayState`。

### 3.3 数据格式

WatchConnectivity payload 使用 JSON-compatible dictionary。

约束：

- 字段保持扁平、低敏。
- 不传明显便血、不舒服、具体排便感受。
- 事件必须有唯一 `id`。
- 所有时间使用 ISO 字符串。

## 4. 数据协议

### 4.1 iPhone -> Watch：今日状态

TypeScript 源类型建议放入：

```text
apps/mobile/src/features/watch/watchTypes.ts
```

Swift 对应模型放入：

```text
apps/mobile/ios/XiaoTiduWatchApp/Models/WatchTodayState.swift
```

协议：

```ts
type WatchTodayState = {
  date: string;
  generatedAt: string;
  proStatus: 'free' | 'pro_active' | 'pro_grace_period' | 'pro_expired';
  account: {
    isLoggedIn: boolean;
    nickname: string | null;
  };
  training: {
    completedSets: number;
    done: boolean;
  };
  trainingModes: Array<{
    holdSeconds: number;
    id: 'beginner' | 'standard' | 'quick';
    restSeconds: number;
    rounds: number;
  }>;
  habits: {
    bowelDone: boolean;
    completion: 0 | 1 | 2 | 3 | 4;
    fiberDone: boolean;
    movementDone: boolean;
    waterDone: boolean;
  };
  toilet: {
    elapsedSeconds: number;
    isPaused: boolean;
    isRunning: boolean;
    sessionCount: number;
    stage: 'normal' | 'gentle_warning' | 'strong_warning' | 'overtime' | 'severe_warning' | null;
  };
  pendingEventCount: number;
};
```

### 4.2 Watch -> iPhone：操作事件

协议：

```ts
type WatchEvent =
  | {
      createdAt: string;
      id: string;
      type: 'training_completed';
      payload: {
        completedSets: number;
        durationSeconds: number;
        mode: 'beginner' | 'standard' | 'quick';
      };
    }
  | {
      createdAt: string;
      id: string;
      type: 'habit_toggled';
      payload: {
        habitKey: 'water' | 'fiber' | 'movement' | 'bowel';
        level: 'good' | null;
      };
    }
  | {
      createdAt: string;
      id: string;
      type: 'toilet_timer_action';
      payload: {
        action: 'pause' | 'resume' | 'finish';
        elapsedSeconds: number;
      };
    };
```

### 4.3 iPhone -> Watch：事件处理结果

协议：

```ts
type WatchEventAck = {
  eventId: string;
  message?: string;
  state?: WatchTodayState;
  stateJson?: string;
  status: 'accepted' | 'rejected' | 'duplicate';
};
```

处理规则：

- iPhone 对 `eventId` 去重。
- 成功处理后返回 `accepted`。
- 已处理过返回 `duplicate`。
- 当前状态不允许处理时返回 `rejected`，并附简短 message。
- ACK 尽量携带最新 `WatchTodayState` 或 `stateJson`，Watch 收到后立即刷新页面。

## 5. iPhone 端开发任务

### I1. Watch 类型与状态计算

新增：

```text
apps/mobile/src/features/watch/watchTypes.ts
apps/mobile/src/features/watch/watchStateBuilder.ts
```

职责：

- 从本地训练、小账本、蹲会儿、auth store 计算 `WatchTodayState`。
- 保持低敏字段。
- 从 iPhone 端训练 preset 生成 `trainingModes`，Watch 不再自行定义模式时长。
- 非 Pro 用户只同步蹲会儿今日次数，不同步进行中计时、暂停状态或阶段。
- 不访问后端。

验收：

- 单元或类型测试覆盖状态结构。
- 未登录、免费、Pro、蹲会儿进行中状态都能生成。
- 免费用户即使 iPhone 有进行中蹲会儿，Watch state 也应表现为 `isRunning = false` 且只带 `sessionCount`。

### I2. WatchConnectivity 原生桥接

新增：

```text
apps/mobile/ios/app/WatchConnectivityManager.swift
apps/mobile/ios/app/WatchConnectivityModule.swift
```

职责：

- 激活 `WCSession`。
- 发送 `WatchTodayState` 到 Watch。
- 接收 WatchEvent。
- 将事件转给 JS 或本地 handler。
- 返回 WatchEventAck。

React Native 暴露方法：

```ts
type WatchConnectivityNativeModule = {
  isSupported(): Promise<boolean>;
  activate(): Promise<boolean>;
  sendTodayState(state: WatchTodayState): Promise<void>;
  getLastReachability(): Promise<{ isPaired: boolean; isReachable: boolean; isWatchAppInstalled: boolean }>;
};
```

### I3. JS 同步服务

新增：

```text
apps/mobile/src/features/watch/watchSyncService.ts
```

触发点：

- App 启动。
- App 回到前台。
- 登录、退出和权益刷新。
- 进入 `/watch` 页面。
- 菊花抬完成。
- 小账本变化。
- 蹲会儿开始、暂停、继续、收工。

职责：

- 先刷新 `/me/entitlements`。
- 调用 `buildWatchTodayState()`。
- 调用 native module 发送。
- 捕获错误，不影响 iPhone 本地功能。

### I4. Watch 事件处理

新增：

```text
apps/mobile/src/features/watch/watchEventHandler.ts
```

处理：

- `training_completed`：写入训练完成记录。
- `habit_toggled`：更新小账本对应项。
- `toilet_timer_action`：
  - `pause`：暂停当前 iPhone 蹲会儿 session。
  - `resume`：继续当前 session。
  - `finish`：结束 session，并生成需要补充详情的记录。

注意：

- 不能上传敏感数据。
- 云端同步仍由现有 share/report sync 服务处理。

### I5. iPhone UI 入口

新增或调整：

- `/me` 页增加 `Apple Watch` 入口。
- `/pro` 页展示 Watch 是 Pro 权益。
- 新增 `/watch` 页面用于：
  - 显示配对状态。
  - 显示是否安装 Watch App。
  - 手动同步状态。
  - 说明 Watch 功能范围。
  - 生产环境只展示用户可理解的连接状态和同步入口。
  - `__DEV__` 下展示连接诊断、最近消息、ACK、待同步 JSON 和事件日志。

## 6. Watch 端开发任务

### W1. watchOS target 与启动页

交付：

- 新增 watchOS App target。
- Watch App 可启动。
- 显示基础首页。
- 能读取本地缓存的 `WatchTodayState`。

验收：

- Watch 模拟器能启动。
- 未收到 iPhone 状态时显示空态。

### W2. WatchSessionManager

职责：

- 激活 Watch 端 `WCSession`。
- 接收 iPhone 状态。
- 发送 WatchEvent。
- 保存最近一次状态到本地。
- 维护待同步事件队列。

文件：

```text
apps/mobile/ios/XiaoTiduWatchApp/Services/WatchSessionManager.swift
apps/mobile/ios/XiaoTiduWatchApp/Services/WatchEventQueue.swift
```

### W3. Watch 首页

页面：

```text
Views/WatchHomeView.swift
```

展示：

- 今日菊花抬。
- 小账本 `x/4`。
- 蹲会儿状态。
- 待同步数量。

操作：

- Pro 用户点击状态行进入菊花抬、小账本、蹲会儿。
- 非 Pro 用户状态行只读，不进入操作页。
- 蹲会儿深链只有在 Pro 且蹲会儿进行中时才可进入。

### W4. 菊花抬训练

页面：

```text
Views/WatchTrainingModeView.swift
Views/WatchTrainingSessionView.swift
```

能力：

- 选择新手、标准、快速模式，模式配置由 iPhone 下发。
- 已选中的模式再次点击会直接开始。
- 训练倒计时由真实时间推导，不把 Timer tick 作为时间源。
- 收紧/放松阶段展示。
- haptic 节奏。
- 完成后发送 `training_completed`。
- 暂停期间冻结显示，继续后暂停时长不计入训练总时长。

### W5. 小账本快速打卡

页面：

```text
Views/WatchHabitsView.swift
```

能力：

- 四项快速达标。
- 已达标再点撤销。
- 发送 `habit_toggled`。

### W6. 蹲会儿状态

页面：

```text
Views/WatchToiletView.swift
```

能力：

- 显示已用时间。
- 显示阶段。
- 暂停/继续。
- 收工。
- 5/10/15/20 分钟 haptic 提醒。
- 页面可纵向滚动，适配小屏 Watch。
- 计时由 iPhone 快照和本地 `Date()` 推导，避免从 0:00 重新开始。
- Watch 收工后 iPhone 同步结束 Live Activity 和阶段通知。

限制：

- 不填写风险详情。
- 不播放音效。

### W7. Complication

文件：

```text
apps/mobile/ios/XiaoTiduWatchComplications/XiaoTiduWatchComplications.swift
```

展示优先级：

1. 状态过期或未同步：显示打开同步。
2. 非 Pro：显示 Pro 锁定态且禁用 widget URL。
3. 蹲会儿进行中：显示计时状态，点击进入蹲会儿页。
4. 普通状态：显示小账本完成度和菊花抬状态，点击进入首页。

## 7. 里程碑

### M1：工程可运行

目标：

- Watch target 存在。
- Watch App 可启动。
- iPhone 和 Watch 能互发测试消息。

验收：

- iPhone 模拟器 + Watch 模拟器可以运行。
- 日志中能看到连接和消息。

### M2：首页状态同步

目标：

- iPhone 生成 `WatchTodayState`。
- Watch 首页展示真实今日状态。

验收：

- 小账本变化后 Watch 首页刷新。
- 蹲会儿开始后 Watch 显示进行中。

### M3：菊花抬闭环

目标：

- Watch 完成菊花抬。
- iPhone 写入记录并更新首页。

验收：

- Watch 完成后 iPhone 今日菊花抬变为完成。

### M4：小账本闭环

目标：

- Watch 快速打卡。
- iPhone 小账本同步更新。

验收：

- 四项都能达标和撤销。

### M5：蹲会儿闭环

目标：

- Watch 查看、暂停、继续、收工。

验收：

- iPhone 蹲会儿状态与 Watch 一致。
- Watch 收工后 iPhone 有记录或补充提示。

### M6：Complication 与真机验收

目标：

- Complication 读取低敏共享状态。
- Complication 点击能回到 Watch App 或蹲会儿页。
- 真机震动体验通过。

验收：

- 表盘显示今日状态。
- 蹲会儿进行中点击 complication 进入 Watch 蹲会儿页。
- 非 Pro 用户 complication 不提供可操作入口。
- 真机 haptic 不过度打扰。

## 8. 测试计划

### 8.1 静态检查

每个阶段至少运行：

```bash
pnpm --filter @xiaotidu/mobile typecheck
pnpm --filter @xiaotidu/mobile exec expo install --check
pnpm peers check
git diff --check
```

涉及 iOS 原生工程后：

```bash
plutil -lint apps/mobile/ios/app/Info.plist apps/mobile/ios/XiaoTiduLiveActivities/Info.plist
```

如新增 Watch plist，也要加入 lint。

### 8.2 构建检查

移动端：

```bash
pnpm --filter @xiaotidu/mobile exec expo run:ios --device "iPhone 17 Pro"
```

Watch 编译检查：

```bash
xcodebuild -workspace apps/mobile/ios/app.xcworkspace -scheme XiaoTiduWatchApp -configuration Debug -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

完整交互还需要通过 Xcode scheme 选择 iPhone + Watch simulator 组合或真机配对后验证。

### 8.3 手动验收

- 未登录时 Watch 显示登录提示。
- 免费用户 Watch 显示今日低敏状态和 Pro 提示，蹲会儿只显示次数。
- Pro 用户 Watch 首页显示今日状态。
- Watch 菊花抬完成后 iPhone 更新。
- Watch 小账本打卡后 iPhone 更新。
- iPhone 开始蹲会儿后 Watch 显示计时。
- Watch 收工后 iPhone 收到事件。
- Watch 收工后 iPhone Live Activity 不再残留计时。
- 免费用户不能从 Watch 发送蹲会儿暂停、继续或收工事件。
- 免费用户点击 Watch 首页状态行不进入操作页。
- iPhone 不可达时 Watch 事件进入待同步。
- 重连后待同步事件清空。
- Complication 过期态、非 Pro 禁用态、蹲会儿深链都符合预期。

### 8.4 真机验收

必须真机验证：

- Watch haptic 强度。
- complication 展示。
- iPhone/Watch 配对稳定性。
- 后台同步和重连。

## 9. 风险与注意事项

- 当前没有 Apple Developer Program 时，无法完整验证真机 Watch、Apple 登录、Push 和部分 capabilities。
- Expo Go 不能运行 Watch App。
- Watch target 是原生工程能力，后续需要维护 `ios/` 目录。
- Watch 端不要访问后端，iPhone 是数据主源。
- Watch 离线队列必须去重，避免重复写入训练或小账本记录。
- 蹲会儿风险详情必须回到 iPhone 填写，Watch 不做敏感记录。

## 10. 推荐开工顺序

1. 先做 iPhone 端 `WatchTodayState` 和 `WatchEvent` TypeScript 类型。
2. 再做 iPhone 端 Swift WatchConnectivity manager。
3. 新增 watchOS target 和 WatchSessionManager。
4. 跑通 iPhone <-> Watch 测试消息。
5. 做 Watch 首页。
6. 做菊花抬。
7. 做小账本。
8. 做蹲会儿。
9. 做 complication。
10. 最后真机验收和 Pro 权限回归。
