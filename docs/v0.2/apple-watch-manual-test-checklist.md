# Apple Watch 手动测试清单

版本：v0.2 开发验证版

本文用于验证小提督 Apple Watch 联动。当前阶段重点验证 iPhone 与 Watch 的数据同步协议、页面反馈、离线兜底和表盘 Complication 真实状态展示，不包含真机 haptic 手感验收。

最新记录：

- 2026-06-16：Apple Watch 真机初步测试通过，基础安装、启动和联动链路可继续进入完整回归。本清单仍用于后续逐项留痕。

## 测试前准备

- [ ] 在 Xcode 打开 `apps/mobile/ios/app.xcworkspace`。
- [ ] Scheme 先选择 `app`，Destination 选择已配对的 `iPhone + Apple Watch` 模拟器组合。
- [ ] 启动 Metro：

```bash
pnpm mobile:start -- --clear
```

- [x] Run `app`，确认 iPhone 模拟器或真机进入小提督。
- [ ] 切换 Scheme 到 `XiaoTiduWatchApp`，Destination 选择配对的 Apple Watch 模拟器。
- [x] Run `XiaoTiduWatchApp`，确认 Watch 上能打开小提督。
- [ ] iPhone 进入 `我的 -> Apple Watch`。
- [ ] 如果是开发构建，确认页面底部显示联动调试面板；如果是生产构建，确认不展示连接诊断、JSON 和事件日志。

## 基础连接

- [ ] `/watch` 页面显示 `支持 = 是`。
- [ ] `/watch` 页面显示 `已配对 = 是`。
- [ ] `/watch` 页面显示 Watch App 状态。
- [ ] Watch App 首页不再显示底层英文错误。
- [ ] 点击 iPhone `/watch` 的 `同步今日状态`。
- [ ] 开发构建下，`/watch` 调试面板 `最近发送` 变为 `已发出` 或显示明确原因。
- [ ] 生产构建下，`/watch` 只展示用户可理解的连接状态和同步结果，不展示 WatchConnectivity 底层字段。
- [ ] Watch 首页能看到今日状态。

## Watch 首页

- [ ] Pro 或 Pro 宽限期状态下，首页菊花抬、小账本、蹲会儿状态行可点击进入对应页面。
- [ ] 首页下方不再重复展示独立入口按钮。
- [ ] 非 Pro、未登录或 Pro 过期状态下，首页状态行只读，点击不进入操作页。
- [ ] 非 Pro 状态下仍能看到今日低敏状态，蹲会儿展示为今日次数。

## App 到 Watch：小账本

- [ ] iPhone 首页小账本点击 `饮水` 达标。
- [ ] Watch 小账本页最多 5 秒内显示饮水已达标。
- [ ] iPhone 首页再次点击 `饮水` 撤销。
- [ ] Watch 小账本页最多 5 秒内显示饮水未达标。
- [ ] iPhone 依次修改纤维、活动、排便。
- [ ] Watch 首页的小账本完成度同步变化。
- [ ] `/watch` 调试面板 `当前待同步 JSON` 中 `habits.completion` 与 iPhone UI 一致。

## Watch 到 App：小账本

- [ ] Watch 小账本页点击 `饮水` 达标。
- [ ] Watch UI 立即乐观显示已达标。
- [ ] iPhone 首页小账本同步变为达标。
- [ ] `/watch` 调试面板 `最近 Watch 消息` 显示 `habit_toggled`。
- [ ] `/watch` 调试面板 `最近 ACK` 显示 `accepted`。
- [ ] Watch 再次点击饮水撤销。
- [ ] iPhone 首页小账本同步撤销。

## App 到 Watch：蹲会儿

- [ ] 当前账号为 Pro 或 Pro 宽限期。
- [ ] iPhone 进入蹲会儿并开始计时。
- [ ] Watch 首页显示蹲会儿进行中。
- [ ] Watch 蹲会儿页计时开始滚动，初始值接近 iPhone 当前用时，不从 `0:00` 开始。
- [ ] Watch 蹲会儿页可纵向滚动，小屏设备上底部按钮不会被截断。
- [ ] Watch 蹲会儿页计时连贯，允许系统调度造成短暂刷新延迟，但下一帧应追上真实时间。
- [ ] iPhone 点击暂停。
- [ ] Watch 蹲会儿页最多 5 秒内显示已暂停。
- [ ] iPhone 点击继续。
- [ ] Watch 蹲会儿页最多 5 秒内恢复滚动。
- [ ] iPhone 收工或放弃计时。
- [ ] Watch 蹲会儿页最多 5 秒内显示未进行。

## Watch 到 App：蹲会儿

- [ ] 当前账号为 Pro 或 Pro 宽限期。
- [ ] iPhone 先开始蹲会儿。
- [ ] Watch 蹲会儿页点击暂停。
- [ ] iPhone 蹲会儿页显示已暂停。
- [ ] Watch 蹲会儿页点击继续。
- [ ] iPhone 蹲会儿页恢复计时。
- [ ] Watch 蹲会儿页点击收工。
- [ ] Watch 弹出收工确认 UI，确认按钮出现无明显长时间卡顿。
- [ ] iPhone 蹲会儿计时结束并保存记录。
- [ ] iPhone 灵动岛 / Live Activity 同步结束，不残留计时状态。
- [ ] `/watch` 调试面板 `最近 Watch 消息` 显示 `toilet_timer_action`。

## Watch 到 App：菊花抬

- [ ] Watch 进入菊花抬页面。
- [ ] 模式时长与 iPhone 端训练 preset 一致：新手、标准、快速都按 iPhone 下发配置展示。
- [ ] 点击未选中的模式只切换选中态。
- [ ] 再次点击当前选中的模式会直接开始训练。
- [ ] 点击 `开始一组` 开始当前选中模式，按钮下方没有额外背景卡片。
- [ ] 选择一种模式并完成一组。
- [ ] 倒计时根据真实时间推进，短暂卡顿后下一帧能追上真实时间，不累计漂移。
- [ ] 训练中点击暂停，倒计时停止。
- [ ] 暂停数秒后点击继续，暂停期间不计入训练总时长。
- [ ] 训练中点击结束本组，出现确认。
- [ ] 确认结束后不记录本组。
- [ ] iPhone 今日菊花抬完成组数增加。
- [ ] 完成后 Watch 显示完成页。
- [ ] Watch 首页训练状态同步更新。
- [ ] `/watch` 调试面板 `最近 Watch 消息` 显示 `training_completed`。

## Pro 门槛

- [ ] 免费版或未登录状态下，Watch 首页只显示今日低敏状态。
- [ ] 免费版状态下，Watch 首页蹲会儿只显示今日次数，例如 `1 次`。
- [ ] 免费版状态下，即使 iPhone 正在蹲会儿，Watch 也不显示计时、暂停或阶段状态。
- [ ] 免费版状态下，Watch 蹲会儿页只显示今日次数和 Pro 提示，不显示暂停、继续、收工按钮。
- [ ] 免费版状态下，点击 Watch 首页菊花抬、小账本、蹲会儿状态行无效。
- [ ] 免费版状态下，Complication 显示 Pro 锁定态且点击无跳转。
- [ ] 免费版状态下，iPhone `/watch` 的待同步 JSON 中 `toilet.sessionCount` 为今日次数，`elapsedSeconds = 0`，`isRunning = false`，`isPaused = false`，`stage = null`。
- [ ] 免费版或未登录状态下，Watch 操作入口显示 Pro 锁定说明。
- [ ] 免费版、未登录或 Pro 过期状态下，即使 Watch 发出历史离线事件，iPhone 也返回中文拒绝 ACK，不写入新记录。
- [ ] iPhone 端手动开通 Pro 并同步后，Watch 操作入口恢复可用。

## ACK 与重复事件

- [ ] Watch 触发一次小账本打卡。
- [ ] Watch 首页显示 `iPhone 已同步` 或等价成功反馈。
- [ ] 重复触发同一个待同步事件时，Watch 不应产生重复记录。
- [ ] 如果 iPhone 拒绝事件，Watch 应显示中文错误，不显示底层英文。

## 离线队列

- [ ] 先让 Watch App 打开。
- [ ] 关闭 iPhone App 或让 WatchConnectivity 暂不可达。
- [ ] 在 Watch 上执行一次小账本打卡。
- [ ] Watch 不崩溃，事件进入待同步队列。
- [ ] 重新打开 iPhone App 并进入 `/watch`。
- [ ] Watch 队列被 flush，iPhone 状态更新。
- [ ] Watch 首页待同步数量回到 0。
- [ ] Watch 首页 `待同步队列` 展示待同步事件摘要。

## Complication

- [ ] Xcode 能识别 `XiaoTiduWatchComplications` target。
- [ ] Watch App 构建时包含 Complication 扩展。
- [ ] 表盘组件读取最近同步的低敏状态，显示小账本完成度或菊花抬状态。
- [ ] 状态过期或未同步过时，表盘组件显示打开同步提示。
- [ ] 普通状态下点击表盘入口可以回到小提督 Watch App 首页。
- [ ] Pro 用户蹲会儿进行中时，表盘组件显示蹲会儿状态，点击后进入 Watch 蹲会儿页。
- [ ] 非 Pro 用户表盘组件显示 Pro 锁定态，点击不进入操作页。
- [ ] 圆形组件显示进度 gauge 和短状态，矩形组件显示图标、标题、详情和 footnote，inline 组件只显示短文案。
- [ ] 当前表盘组件不展示敏感数据。

## 隐私边界

- [ ] Watch 今日状态不显示便血、不适、排便感受详情。
- [ ] Watch 只显示低敏状态：训练、小账本完成度、蹲会儿今日次数；Pro 用户可额外显示当前蹲会儿是否进行中。
- [ ] `/watch` JSON 调试信息仅在开发环境展示，正式版不显示。

## 常见问题定位

- 如果 iPhone 状态变化但 Watch 不变：
  - [ ] 查看 `/watch` 的 `当前待同步 JSON` 是否已变。
  - [ ] 查看 `最近发送` 是否已发出。
  - [ ] 查看 Watch 是否可达。
  - [ ] 保持 iPhone App 在前台，等待 Watch 5 秒主动拉取。

- 如果 Watch 操作后 iPhone 不变：
  - [ ] 查看 `/watch` 的 `最近 Watch 消息`。
  - [ ] 查看 `最近 ACK` 是否为 `accepted`。
  - [ ] 如果没有消息，优先检查 WatchConnectivity 配对和可达状态。

- 如果 Xcode 启动的是 Live Activity 扩展：
  - [ ] Scheme 明确选择 `app` 或 `XiaoTiduWatchApp`。
  - [ ] 不要选择 `XiaoTiduLiveActivities`。
  - [ ] 必要时清理 DerivedData 后重新打开 workspace。
