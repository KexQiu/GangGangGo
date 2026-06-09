# 小提督 v0.2 Apple Watch 需求文档

版本：v0.2
日期：2026-05-26
阶段：详细需求规划

说明：用户口语中的 iWatch 在本文档中统一称为 **Apple Watch**。

## 1. 产品目标

Apple Watch 联动是小提督 Pro 的核心增强能力之一。目标不是把 iPhone App 完整搬到手表上，而是让用户在手腕上完成高频、短路径、低负担的健康习惯动作。

核心目标：

- 降低菊花抬训练的操作成本。
- 用手表震动帮助用户跟随收紧/放松节奏。
- 让小账本达标打卡更顺手。
- 让蹲会儿状态在手腕上可见，并支持快速收工。
- 在不打开手机的情况下查看今日轻量状态。

Apple Watch 端仍然遵守小提督的产品边界：

- 不做医疗诊断。
- 不展示敏感健康细节。
- 不鼓励过度打卡或排行。
- 不把风险信号做成社交反馈。

## 2. 会员边界

Apple Watch 联动属于 **小提督 Pro** 功能。

免费用户：

- iPhone 端 v0.1 本地功能保持完整可用。
- 可以看到 Apple Watch 功能介绍和 Pro 引导。
- Watch App 可展示今日低敏状态，其中蹲会儿只展示今日次数。
- 不提供 Watch App 的完整操作同步能力。
- 不允许使用 Watch 蹲会儿计时同步、暂停、继续或收工。

Pro 用户：

- 可以使用 Watch 首页、菊花抬、快速小账本、蹲会儿状态查看。
- 可以同步 Watch 操作到 iPhone。
- 可以使用基础 complication。

取消订阅后：

- Watch App 可展示只读提示：`小提督 Pro 已暂停`。
- 不再允许从 Watch 新增训练、打卡和蹲会儿操作。
- iPhone 本地历史记录不删除。
- 重新订阅后恢复 Watch 功能。

## 3. MVP 范围

v0.2 Apple Watch MVP 只做高频闭环。

必须实现：

- Watch 首页。
- 今日状态查看。
- 菊花抬训练。
- 小账本快速达标。
- 蹲会儿状态查看和收工。
- WatchConnectivity 与 iPhone 同步。
- Watch 离线操作的待同步队列。
- 基础 complication。

暂不实现：

- Watch 端登录。
- Watch 端 Pro 购买。
- Watch 端小队管理。
- Watch 端搭子提醒发送。
- Watch 端三档小账本精细调整。
- Watch 端最近小报告。
- Watch 端安全说明全文。
- Watch 端自由文本、聊天、评论或排行榜。

## 4. 使用前提

用户需要满足：

- 已安装 iPhone App。
- iPhone App 已登录小提督账号。
- 当前权益为 `pro_active` 或 `pro_grace_period`。
- iPhone 已配对 Apple Watch。
- Watch App 已安装。

异常情况：

- 未登录：Watch 显示 `先在 iPhone 上登录小提督`。
- 非 Pro：Watch 显示 `Apple Watch 是小提督 Pro 功能`。
- 未同步到 iPhone：Watch 显示最近本地缓存状态，并提示稍后同步。
- iPhone 不可达：允许记录离线操作，重连后补同步。

## 5. 信息架构

Watch App 采用浅层结构，避免复杂导航。

```text
Watch 首页
  ├─ 菊花抬
  │   ├─ 模式选择
  │   └─ 训练中
  ├─ 小账本
  │   └─ 四项快速达标
  └─ 蹲会儿
      └─ 当前状态 / 收工
```

页面原则：

- 一屏只承载一个主要动作。
- 文案短，避免长段说明。
- 所有动作都要能单手快速完成。
- 使用系统按钮、列表和明显触控区域。
- 震动反馈用于节奏和确认，不使用声音。

## 6. Watch 首页

### 6.1 展示内容

Watch 首页展示今日低敏状态：

- 菊花抬：`未开始 / 已营业 / 已完成`
- 小账本：`0/4 - 4/4`
- 蹲会儿：
  - Pro：`未开始 / 进行中 / 已记过`
  - 非 Pro：只展示今日蹲会儿次数，例如 `1 次`
- 下一次小暗号：可选展示，只显示隐私文案。

推荐文案：

- 标题：`小提督`
- 副文案：`今天轻轻来一点`
- 菊花抬入口：`菊花抬`
- 小账本入口：`小账本`
- 蹲会儿入口：`蹲会儿`

### 6.2 操作入口

首页提供 3 个主要入口：

- `开始菊花抬`
- `小账本`
- `蹲会儿`

如果有正在进行中的蹲会儿：

- 首页应突出显示 `蹲会儿进行中`
- 显示已用时间
- 提供 `收工` 快捷按钮

### 6.3 空状态

未与 iPhone 同步过：

- 标题：`等 iPhone 递个小纸条`
- 文案：`打开 iPhone 上的小提督后，手表就能看到今日状态。`

非 Pro：

- 标题：`手腕小助手在 Pro 里`
- 文案：`Apple Watch 联动属于小提督 Pro。`
- 首页仍可展示今日低敏状态；蹲会儿只展示次数，不展示计时状态。
- 训练、小账本、蹲会儿操作入口保持锁定。

## 7. 菊花抬训练

### 7.1 模式

Watch 端支持三种模式：

- 新手模式
- 标准模式
- 快速模式

模式定义沿用 iPhone 端，不在 Watch 端重新定义规则。

### 7.2 训练流程

流程：

1. 用户进入 `菊花抬`。
2. 选择模式。
3. 点击 `开始`。
4. Watch 显示当前轮次和阶段。
5. 通过震动提示收紧和放松。
6. 用户可暂停、继续、提前结束。
7. 完成后写入本地待同步事件，并同步回 iPhone。

### 7.3 训练中展示

训练中展示：

- 当前模式。
- 当前阶段：`轻轻抬 / 放松`
- 当前轮次。
- 剩余时间。
- 暂停按钮。
- 结束按钮。

推荐文案：

- 收紧阶段：`轻轻抬`
- 放松阶段：`放松一下`
- 完成：`小花今日营业完成`
- 中途结束：`这次先记到这里`

### 7.4 震动规则

Watch 只使用 haptic，不播放声音。

建议规则：

- 训练开始：轻震一次。
- 进入收紧阶段：轻震一次。
- 进入放松阶段：更轻的短震一次。
- 每组完成：轻震两次。
- 全部完成：成功震动。
- 中途结束：普通确认震动。

震动要克制，不做连续强震。

### 7.5 数据同步

训练完成后同步字段：

- `source = watch`
- `mode`
- `completed`
- `startedAt`
- `endedAt`
- `durationSeconds`
- `completedSets`

不需要同步每一次收紧/放松的细粒度过程。

如果 iPhone 不可达：

- Watch 本地保存待同步事件。
- 首页显示 `待同步 1 条`。
- 重连后自动发送。

## 8. 小账本快速打卡

### 8.1 Watch 端范围

Watch 只做快速达标，不做三档精细调整。

可快速打卡：

- 饮水达标。
- 纤维达标。
- 活动达标。
- 排便顺畅。

不支持：

- 不足 / 一般 / 达标三档滑块。
- 排便困难详情。
- 明显便血、不适记录。

### 8.2 交互规则

每项为一个大触控按钮。

未达标：

- 点击后记为 `good`。

已达标：

- 再点撤销，恢复未记录。

与 iPhone 首页保持一致：不额外展示“再点撤销”强提示，减少操作说明。

### 8.3 展示文案

- 饮水：`8 杯左右`
- 纤维：`2 餐+`
- 活动：`30 分钟`
- 排便：`少用力`

底部轻提示：

- `精细记一笔，回 iPhone 上调。`

### 8.4 数据同步

同步字段：

- `source = watch`
- `habitKey`
- `level = good | null`
- `date`
- `updatedAt`

冲突处理：

- 以最新 `updatedAt` 为准。
- 如果 iPhone 已经记录为 `low` 或 `medium`，Watch 点达标会覆盖为 `good`。
- 用户可回 iPhone 精细调整。

## 9. 蹲会儿

### 9.1 Watch 端目标

Watch 端只做状态查看和快速收工，不鼓励用户在 Watch 上长时间操作。

蹲会儿计时同步属于 Pro 能力。非 Pro 用户在 Watch 端只能看到今日蹲会儿次数，不能查看进行中计时，也不能从 Watch 暂停、继续或收工。

支持：

- 查看是否正在蹲会儿。
- 查看已用时间。
- 查看当前阶段。
- 暂停 / 继续。
- 收工。

不支持：

- Watch 端填写收工记录详情。
- Watch 端记录明显便血或明显不舒服。
- Watch 端播放阶段音效。

### 9.2 状态展示

状态：

- `未开始`
- `刚刚蹲下`
- `小声敲门`
- `差不多该收工了`
- `蹲会儿长会了`
- `真的该收工了`

展示内容：

- 已用时间。
- 阶段标题。
- 简短提示。

推荐提示：

- 5 分钟：`正事办完就撤。`
- 10 分钟：`差不多该收工了。`
- 15 分钟：`这趟有点长。`
- 20 分钟：`真的该收工了。`

### 9.3 阶段提醒

Watch 端可使用 haptic 提醒：

- 5 分钟：轻震。
- 10 分钟：中等提醒。
- 15 分钟：更明显提醒。
- 20 分钟：强提醒。

Watch 不播放阶段音效。

如果 iPhone App 已在前台播放音效，Watch 仍只震动，不重复发声音。

### 9.4 收工流程

Watch 点击 `收工` 后：

1. 结束当前计时。
2. 同步给 iPhone。
3. iPhone 端生成一条基础蹲会儿记录。
4. 如果需要补充“不舒服/便血”等风险信息，用户回 iPhone 填写。

Watch 收工记录默认字段：

- `source = watch`
- `durationSeconds`
- `endedAt`
- `hasDiscomfort = false`
- `hasBlood = false`
- `needsDetail = true`

iPhone 可在首页或蹲会儿记录页提示：

- `这趟从手表收工了，需要的话可以补充细节。`

## 10. Complication

v0.2 MVP 做一个基础 complication。

展示优先级：

1. 如果蹲会儿进行中：显示已用时间。
2. 如果菊花抬未完成：显示菊花抬状态。
3. 如果小账本未满格：显示小账本 `x/4`。
4. 全部完成：显示 `今日稳定`。

点击行为：

- 进入 Watch App 首页。

不展示：

- 风险信息。
- 明显便血。
- 不舒服。
- 具体好友动态。

## 11. 与 iPhone 同步

### 11.1 同步原则

iPhone 是主数据源。

Watch 负责：

- 展示 iPhone 同步过来的今日状态。
- 生成高频轻量操作事件。
- 在 iPhone 不可达时暂存事件。

### 11.2 同步方向

iPhone -> Watch：

- 今日状态。
- Pro 权益状态。
- 训练模式配置。
- 蹲会儿当前状态。
- 小账本当前状态。

Watch -> iPhone：

- 菊花抬完成事件。
- 小账本快速打卡事件。
- 蹲会儿暂停/继续/收工事件。

### 11.3 事件协议

Watch -> iPhone 事件建议：

```ts
type WatchEvent =
  | {
      id: string;
      type: 'training_completed';
      createdAt: string;
      payload: {
        mode: 'beginner' | 'standard' | 'quick';
        durationSeconds: number;
        completedSets: number;
      };
    }
  | {
      id: string;
      type: 'habit_toggled';
      createdAt: string;
      payload: {
        habitKey: 'water' | 'fiber' | 'movement' | 'bowel';
        level: 'good' | null;
      };
    }
  | {
      id: string;
      type: 'toilet_timer_action';
      createdAt: string;
      payload: {
        action: 'pause' | 'resume' | 'finish';
        elapsedSeconds: number;
      };
    };
```

iPhone -> Watch 状态建议：

```ts
type WatchTodayState = {
  date: string;
  proStatus: 'free' | 'pro_active' | 'pro_grace_period' | 'pro_expired';
  training: {
    done: boolean;
    completedSets: number;
  };
  habits: {
    completion: 0 | 1 | 2 | 3 | 4;
    waterDone: boolean;
    fiberDone: boolean;
    movementDone: boolean;
    bowelDone: boolean;
  };
  toilet: {
    elapsedSeconds: number;
    isPaused: boolean;
    isRunning: boolean;
    sessionCount: number;
    stage: 'normal' | 'gentle_warning' | 'strong_warning' | 'overtime' | 'severe_warning' | null;
  };
};
```

非 Pro 用户的 `toilet` 字段必须只暴露今日次数：

- `sessionCount` 为今日蹲会儿次数。
- `elapsedSeconds = 0`。
- `isRunning = false`。
- `isPaused = false`。
- `stage = null`。

### 11.4 冲突处理

- 每条 Watch 事件必须有唯一 `id`，iPhone 去重。
- 同一小账本项多端修改，以 `updatedAt` 最新为准。
- 菊花抬训练完成事件可追加记录，但同一事件 ID 不重复入账。
- 蹲会儿计时以 iPhone 当前 session 为准；Watch 操作如果 session 不存在，应返回失败状态并刷新 Watch。

## 12. 隐私要求

Watch 端不展示：

- 明显便血。
- 明显不舒服。
- 排便困难详情。
- 具体蹲会儿历史时长。
- 搭子提醒内容历史。
- 小队成员具体健康细节。

Watch 端可展示：

- 今日是否完成。
- 小账本完成度。
- 今日蹲会儿次数。
- Pro 用户可展示当前蹲会儿是否进行中和已用时间。
- Pro 状态。

锁屏/表盘 complication 要更克制：

- 不出现“便血”“疼痛”等敏感词。
- 不展示好友或小队状态。
- 不展示完整如厕历史。

## 13. 错误与空状态

### 13.1 iPhone 不可达

标题：`iPhone 暂时没接上`

文案：`操作会先记在手表里，连上后再交给小提督。`

行为：

- 允许菊花抬完成和小账本快速打卡进入待同步。
- 蹲会儿操作如果没有本地 session，不允许新建复杂记录，只提示回 iPhone。

### 13.2 未登录

标题：`先在 iPhone 登录`

文案：`打开 iPhone 上的小提督，登录后手表就能接上。`

### 13.3 非 Pro

标题：`手腕小助手在 Pro 里`

文案：`Apple Watch 联动是小提督 Pro 功能。`

### 13.4 同步失败

标题：`稍后再交接`

文案：`这条记录先留在手表里，连上 iPhone 后再同步。`

## 14. 数据与埋点

只记录产品改进必要的低敏行为指标。

建议指标：

- Watch App 激活用户数。
- Watch 菊花抬开始次数。
- Watch 菊花抬完成次数。
- Watch 小账本快速打卡次数。
- Watch 蹲会儿收工次数。
- Watch 离线事件同步成功率。
- Watch 入口到 Pro 转化率。

不记录：

- 明显便血。
- 明显不舒服。
- 具体排便感受。
- 详细如厕历史。

## 15. 验收标准

### 15.1 首页

- Watch 能显示今日菊花抬、小账本和蹲会儿状态。
- iPhone 更新状态后，Watch 能刷新。
- 非 Pro 和未登录状态显示正确空态。

### 15.2 菊花抬

- Watch 能选择三种模式。
- 训练过程中有清晰的收紧/放松节奏。
- 震动节奏可感知但不过度打扰。
- 完成后 iPhone 首页显示今日已完成。
- 离线完成后，重连 iPhone 能补同步。

### 15.3 小账本

- Watch 能快速将四项记为达标。
- 已达标项再次点击可撤销。
- iPhone 首页和小账本详情页能同步更新。
- Watch 不展示三档精细选择。

### 15.4 蹲会儿

- Watch 能看到进行中的蹲会儿计时。
- Watch 能暂停、继续、收工。
- 5/10/15/20 分钟阶段震动有区分。
- Watch 收工后 iPhone 能生成记录或提示补充详情。
- Watch 不播放音效。

### 15.5 Complication

- 表盘能显示今日关键状态。
- 蹲会儿进行中时优先显示计时。
- 点击 complication 能进入 Watch App。
- complication 不展示敏感信息。

## 16. 测试要求

开发阶段：

- iPhone 模拟器 + Watch 模拟器基础 UI 测试。
- WatchConnectivity 模拟器联调。
- 离线队列单元测试。

真机阶段：

- iPhone + Apple Watch 真机配对测试。
- Pro 权益状态测试。
- Watch 菊花抬震动测试。
- 蹲会儿阶段震动测试。
- complication 表盘测试。

限制：

- 真实 Watch 功能需要 Apple Developer Program、签名和 watchOS target。
- Expo Go 不能测试 Watch App。
- Watch 真机震动体验必须在真实设备上验收。

## 17. 分阶段实现建议

### W1：工程与通信骨架

- 新增 watchOS target。
- 建立 WatchConnectivity 基础通道。
- iPhone 能向 Watch 发送 `WatchTodayState`。
- Watch 能向 iPhone 发送测试事件。

### W2：Watch 首页

- 显示今日状态。
- 处理未登录、非 Pro、iPhone 不可达。
- 支持手动刷新。

### W3：菊花抬

- 模式选择。
- 训练中页面。
- haptic 节奏。
- 完成同步。

### W4：小账本

- 四项快速达标。
- 撤销。
- 同步到 iPhone。

### W5：蹲会儿

- 显示当前计时。
- 暂停、继续、收工。
- 阶段震动。

### W6：Complication 与真机验收

- 基础 complication。
- 真机配对测试。
- 离线补同步测试。
- Pro 权限回归。
