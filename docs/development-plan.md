# 肛肛好开发方案

版本：v0.3
日期：2026-05-21
阶段：当前工程说明与后续开发基线
关联文档：[产品定位文档](./product-positioning.md)、[PRD](./prd-v0.1.md)

## 1. 当前工程目标

当前项目是一个本地优先的 Expo + React Native 移动端 App，用于完成肛肛好 V1 的核心闭环：

菊花抬 -> 小暗号提醒 -> 蹲会儿 -> 小账本 -> 今日正反馈 -> 最近小报告 -> 小花说明书。

V1 不依赖服务端，不要求登录，不上传健康数据。所有训练、打卡、蹲会儿记录、提醒设置和 App 设置都保存在本机。

## 2. 当前技术栈

- 框架：Expo + React Native
- 语言：TypeScript
- 路由：Expo Router
- 包管理：pnpm
- 状态管理：zustand
- 本地数据：expo-sqlite
- kv 持久化：expo-sqlite/kv-store + zustand persist
- 本地通知：expo-notifications
- 震动反馈：expo-haptics
- 阶段音效：expo-audio
- 图标：lucide-react-native + react-native-svg 自定义图标
- 样式：React Native StyleSheet
- iOS 原生能力：ActivityKit + WidgetKit Extension
- 开发构建：expo-dev-client + EAS
- 类型检查：tsc

当前脚本：

```bash
pnpm start
pnpm run ios
pnpm run android
pnpm start:dev-client
pnpm run typecheck
pnpm expo install --check
pnpm peers check
```

## 3. 当前路由结构

```text
app/
  _layout.tsx
  index.tsx
  settings/
    index.tsx
  training/
    index.tsx
    session.tsx
    complete.tsx
  toilet/
    index.tsx
    complete.tsx
  habits/
    index.tsx
  reminders/
    index.tsx
  safety/
    index.tsx
  trends/
    index.tsx
```

当前导航原则：

- 不使用底部 Tab。
- `app/index.tsx` 是唯一主首页。
- 设置入口在首页右上角。
- 二级页统一使用 `AppTopBar` 返回或关闭。
- 训练中、蹲会儿进行中关闭需要确认。

路由常量维护在 `src/navigation/routes.ts`，新增页面必须同步新增常量，避免散落字符串。

## 4. 当前源码结构

```text
src/
  components/
    feedback/
      AnimatedCheckBadge.tsx
      PressableScale.tsx
      SuccessBurst.tsx
    AppButton.tsx
    AppCard.tsx
    AppTopBar.tsx
    OptionRow.tsx
    PageHeader.tsx
    Screen.tsx
  features/
    habits/
      HabitQuickCheckInCard.tsx
      habitLogic.ts
      habitStandards.ts
      habitStore.ts
      habitTypes.ts
    reminders/
      notificationService.ts
      reminderLogic.ts
      reminderStore.ts
      reminderTypes.ts
    settings/
      appSettingsStore.ts
    today/
      todayFeedback.ts
    toilet/
      toiletLiveActivity.ts
      toiletLogic.ts
      toiletStageNotificationService.ts
      toiletStageSoundService.ts
      toiletStore.ts
      toiletTimerSessionStore.ts
      toiletTypes.ts
    training/
      FlowerLiftIcon.tsx
      presets.ts
      trainingLogic.ts
      trainingStore.ts
      trainingTypes.ts
    trends/
      trendLogic.ts
  storage/
    db.ts
    migrations.ts
    repositories/
      habitRepository.ts
      reminderRepository.ts
      toiletRepository.ts
      trainingRepository.ts
  theme/
    colors.ts
    themeProvider.tsx
    themeStore.ts
```

iOS 原生文件：

```text
ios/
  app/
    ToiletTimerLiveActivityModule.swift
    ToiletTimerLiveActivityModule.m
  GangGangGoLiveActivities/
    Info.plist
    ToiletTimerAttributes.swift
    ToiletTimerLiveActivityWidget.swift
```

资源文件：

```text
assets/
  icon.png
  adaptive-icon.png
  splash-icon.png
  favicon.png
  sounds/
    toilet-knock-5.wav
    toilet-chime-10.wav
    toilet-warning-15.wav
    toilet-stop-20.wav
```

模块原则：

- 业务计算优先写成纯函数，例如 `trainingLogic`、`toiletLogic`、`habitLogic`、`todayFeedback`、`trendLogic`。
- Store 负责加载、保存和暴露状态。
- Repository 负责 SQLite 读写。
- 页面只组合 UI、store 和业务函数。
- 原生能力必须有 JS no-op/fallback，不能阻塞主流程。

## 5. 本地存储

数据库名：`gangganggo.db`

初始化入口：

- `src/storage/db.ts`
- `src/storage/migrations.ts`

### training_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT | 主键 |
| preset_id | TEXT | 训练模式 |
| started_at | TEXT | 开始时间 |
| ended_at | TEXT | 结束时间 |
| duration_seconds | INTEGER | 时长 |
| completed_repetitions | INTEGER | 完成次数 |
| is_completed | INTEGER | 是否完整完成 |
| discomfort_reported | INTEGER | 是否反馈不适，当前保留 |

### toilet_sessions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT | 主键 |
| started_at | TEXT | 开始时间 |
| ended_at | TEXT | 结束时间 |
| duration_seconds | INTEGER | 时长 |
| feeling | TEXT | smooth / normal / difficult |
| discomfort | INTEGER | 是否明显不舒服 |
| bleeding | INTEGER | 是否明显便血 |

### habit_checkins

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| date | TEXT | 主键，YYYY-MM-DD |
| water | TEXT | low / medium / good / null |
| fiber | TEXT | low / medium / good / null |
| movement | TEXT | low / medium / good / null |
| bowel | TEXT | low / medium / good / null |
| updated_at | TEXT | 更新时间 |

### reminder_settings

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT | 固定 default |
| kegel_enabled | INTEGER | 菊花抬提醒开关 |
| kegel_times | TEXT | JSON 字符串 |
| sedentary_enabled | INTEGER | 久坐提醒开关 |
| sedentary_interval_minutes | INTEGER | 久坐间隔 |
| quiet_hours_start | TEXT | 兼容旧单段勿扰开始 |
| quiet_hours_end | TEXT | 兼容旧单段勿扰结束 |
| quiet_hours_ranges | TEXT | JSON 字符串，多段勿扰 |
| privacy_mode | INTEGER | 隐私模式 |
| updated_at | TEXT | 更新时间 |

### kv-store

| key | 说明 |
| --- | --- |
| `gangganggo-theme-settings` | `themeMode: system | light | dark` |
| `gangganggo-app-settings` | 灵动岛计时、蹲会儿离开提醒、阶段音效 |
| `gangganggo-active-toilet-timer` | 正在进行的蹲会儿会话 |

## 6. 核心模块说明

### 6.1 菊花抬训练

关键文件：

- `src/features/training/presets.ts`
- `src/features/training/trainingLogic.ts`
- `src/features/training/trainingStore.ts`
- `src/features/training/FlowerLiftIcon.tsx`
- `app/training/*`

实现规则：

- 新手：3 秒收紧、3 秒放松、10 次。
- 标准：5 秒收紧、5 秒放松、12 次。
- 快速：1 秒收紧、1 秒放松、16 次。
- `buildTrainingTimeline` 生成收紧/放松步骤。
- `getCurrentTrainingStep` 根据 elapsedSeconds 计算当前阶段。
- 完整完成后写入记录，首页和最近小报告自动更新。
- 手动结束会写入未完整完成记录，但首页今日完成数只统计完整完成。
- 完成页完整完成时触发 success haptic 和轻量动效。

### 6.2 小暗号提醒

关键文件：

- `src/features/reminders/reminderLogic.ts`
- `src/features/reminders/notificationService.ts`
- `src/features/reminders/reminderStore.ts`
- `app/reminders/index.tsx`

实现规则：

- 菊花抬提醒按固定每日时间注册本地通知。
- 久坐提醒按未来两天生成本地通知。
- 修改设置时取消旧通知再注册新通知。
- 多段勿扰过滤提醒，最多 4 段。
- 支持夜间、午休 + 夜间、关闭勿扰快速方案。
- 默认隐私模式开启。

限制：

- 久坐提醒是定时活动提醒，不检测真实坐姿。
- 系统通知权限被拒绝时，设置可保存但不会触发系统通知。

### 6.3 蹲会儿

关键文件：

- `src/features/toilet/toiletLogic.ts`
- `src/features/toilet/toiletStore.ts`
- `src/features/toilet/toiletTimerSessionStore.ts`
- `src/features/toilet/toiletStageNotificationService.ts`
- `src/features/toilet/toiletStageSoundService.ts`
- `app/toilet/*`

阶段规则：

- 0-5 分钟：刚刚蹲下。
- 5-10 分钟：小声敲门。
- 10-15 分钟：差不多该收工了。
- 15-20 分钟：蹲会儿长会了。
- 20 分钟以上：真的该收工了。

实现规则：

- 计时中页面保持极简。
- 关闭计时中页面必须确认。
- 进行中的计时会话用 kv-store 持久化。
- 前台阶段切换触发 haptic 和阶段音效。
- 阶段音效默认开启，但不强制绕过系统静音。
- 退后台/锁屏时，如果开启离开提醒，则排后续阶段本地通知。
- 回前台、暂停、收工、放弃时取消未触发阶段通知。
- 收工记录写入 SQLite。
- 15 分钟以上计入最近小报告“蹲会儿长会”。
- 便血或明显不舒服计入最近小报告“小信号”。

### 6.4 iOS 灵动岛 / Live Activity

关键文件：

- `src/features/toilet/toiletLiveActivity.ts`
- `ios/app/ToiletTimerLiveActivityModule.swift`
- `ios/GangGangGoLiveActivities/ToiletTimerLiveActivityWidget.swift`

实现规则：

- 设置页开关 `toiletLiveActivityEnabled` 默认关闭。
- 开启后，蹲会儿开始时启动 Live Activity。
- 暂停、继续、收工、放弃同步或结束 Live Activity。
- Native module 对不支持设备和 iOS 版本做 no-op/fallback。
- Expo Go 不支持；需要 development build 或正式包。
- 当前不使用服务端 push 更新 Live Activity。

### 6.5 小账本

关键文件：

- `src/features/habits/HabitQuickCheckInCard.tsx`
- `src/features/habits/habitStandards.ts`
- `src/features/habits/habitLogic.ts`
- `src/features/habits/habitStore.ts`
- `app/habits/index.tsx`

实现规则：

- 首页快速打卡未记录时一点即记为 `good`。
- 已经是 `good` 时再次点击可撤销为 `null`。
- low / medium 点击首页快速项会改为 `good`。
- 详情页支持 low / medium / good 三档滑块。
- 固定标准集中在 `habitStandards.ts`。
- 每天按 date 主键 upsert。
- 4 项都有值即小账本满格。
- 最近统计由 `calculateRecentHabitStats` 计算。

### 6.6 今日正反馈

关键文件：

- `src/features/today/todayFeedback.ts`
- `app/index.tsx`

输入：

- 今日完整菊花抬次数。
- 今日小账本完成项数。
- 今日蹲会儿记录数。

输出：

- 首页今日反馈标题和正文。
- 三个状态标签：
  - 菊花抬：待营业、已开张、已下班。
  - 小账本：待开张、已记录、满格。
  - 蹲会儿：未记录、已入账。

原则：

- 鼓励“有做一点”和“完成建议量”。
- 不鼓励超量训练。
- 不鼓励增加蹲会儿次数。

### 6.7 最近小报告

关键文件：

- `src/features/trends/trendLogic.ts`
- `app/trends/index.tsx`

实现规则：

- 7 天主视图展示每日变化。
- 30 天摘要补足长期反馈。
- 不引入图表库，用 React Native `View` 绘制小柱状条。
- 蹲会儿长会和小信号用 warning/danger 色，不做庆祝表达。
- 无记录时显示空状态，不渲染空图表。

### 6.8 小花说明书

关键文件：

- `app/safety/index.tsx`

当前为静态内容页，包含：

- 怎么抬比较不费戏。
- 这些时候先让小花下班。
- 这些信号问专业队友。
- 常见小翻车。

安全原则：

- 不诊断。
- 不治疗。
- 不承诺改善。
- 明显便血、剧烈疼痛、不适加重等场景建议咨询医生。

### 6.9 主题

关键文件：

- `src/theme/colors.ts`
- `src/theme/themeProvider.tsx`
- `src/theme/themeStore.ts`

实现规则：

- 默认 `system`。
- 支持 `light` 和 `dark` 手动模式。
- 页面只能使用 theme token，不直接写死颜色。
- 当前主题为绿色健康工具风。
- `app.json` 的 `userInterfaceStyle` 为 `automatic`。

## 7. 开发流程

新增页面：

1. 在 `app/` 下新增路由页面。
2. 在 `src/navigation/routes.ts` 增加路由常量。
3. 使用 `Screen`、`AppTopBar`、`PageHeader`、`AppCard`、`AppButton` 等现有组件。
4. 路由 fallback 指向 `routes.home` 或 `routes.settings`。
5. 运行类型检查。

新增业务逻辑：

1. 优先放到对应 `src/features/*/*Logic.ts`。
2. 尽量写成纯函数。
3. 页面不要直接散落复杂计算。
4. 如果需要持久化，再新增 repository 和 migration。

新增原生能力：

1. JS 层必须有平台判断和 no-op fallback。
2. 原生失败不能阻塞核心 JS 流程。
3. 需要同时说明 Expo Go、development build、正式包的测试差异。
4. 修改 iOS 原生能力后，必须用 development build 或 Xcode 构建验证。

修改文案：

- 菊花抬：可轻松，但要让用户知道是提肛训练。
- 蹲会儿：用“收工、长会、小剧场”等降低羞耻感。
- 小暗号：避免通知栏敏感词。
- 风险场景：必须明确，不玩笑化。

## 8. 验证策略

每次功能性修改后运行：

```bash
pnpm run typecheck
pnpm expo install --check
pnpm peers check
git diff --check
```

手动验收重点：

- 首页默认打开。
- 设置入口可用。
- 菊花抬完整流程。
- 蹲会儿完整流程、阶段提醒、阶段音效、离开通知。
- 小账本首页打卡、撤销和详情页修改。
- 小暗号权限请求、多段勿扰和设置保存。
- 最近小报告统计变化。
- 深色模式显示。
- 风险提示优先级。

iOS 原生验收：

- Expo Go 不能验证 Live Activity。
- Development build 或正式包验证灵动岛计时。
- iOS 16.1+ 支持 Live Activity；有灵动岛的设备显示 Dynamic Island，其他设备显示锁屏 Live Activity。

## 9. 已知边界

- 还没有登录和云同步。
- 还没有数据导出和清除入口。
- 还没有首次使用引导。
- 还没有 Apple Watch、小组件和推送服务端。
- 还没有自动化单元测试。
- 久坐提醒不是真实坐姿检测。
- 安全说明还未接入医生审核内容库。
- Live Activity 当前只做本地开始/暂停/继续/结束，不做服务端推送更新。

## 10. 后续建议

下一阶段建议优先级：

1. 轻量新手引导：解释菊花抬、小暗号、小账本、蹲会儿和安全边界。
2. 数据管理：清除本地数据、导出 JSON/CSV。
3. 自动化测试：优先覆盖 `trendLogic`、`todayFeedback`、`trainingLogic`、`toiletLogic`、`reminderLogic`。
4. 真机验收：development build 验证通知、音效和 Live Activity。
5. App Store/TestFlight 准备。

暂不建议立即做：

- AI 健康助手。
- 社区。
- 订阅付费。
- 复杂健康报告。
