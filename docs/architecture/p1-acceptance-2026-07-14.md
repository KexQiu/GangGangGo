# P1 验收记录（2026-07-14）

本文记录 Architecture v2 的 P1 人工与端到端验收证据。未取得真机证据的项目保持未完成。

## 环境

- Mac：Apple Silicon，Xcode 26.2 工具链。
- iPhone 模拟器：`17 + watch 11`，iPhone 17 Pro，iOS 26.3.1。
- Watch 模拟器：Apple Watch Series 11（46mm），watchOS 26.2，与上述 iPhone 配对。
- 联调账号：`mock-user-a`（Pro、小队创建者）与 `mock-user-b`（受邀成员）。
- API：本地 PostgreSQL 16 与本地 API；测试前只重建固定 mock 用户的云端数据。

## 移动端双用户联调

结果：通过。

- A 登录后正确显示 Pro 权益并创建 1 人小队。
- A 生成并复制邀请链接；切换到 B 后未显示 A 的资料或缓存。
- B 通过深链接受邀请，小队人数由 1/4 更新为 2/4。
- App 终止并重新启动后恢复 B 会话；随后切回 A，未显示 B 的资料缓存。
- A 的小队成员列表正确显示 B。
- 账号切换和 App 重启前后，本地饮水记录保持一致。
- 服务端验收后只有当前账号的一条活动会话，证明退出登录已撤销旧 refresh session。

自动化入口：

```bash
pnpm mobile:ui:prepare
xcodebuild -workspace apps/mobile/ios/app.xcworkspace \
  -scheme app -configuration Debug \
  -destination 'id=57B419A1-8BCF-459A-ACF9-41A2B2BFFE61' \
  -only-testing:appUITests/GangGangGoUITests/testMockUsersCanJoinTeamWithoutLeakingAccountCache \
  test
```

## Watch

已通过：

- Watch schema v2 与共享 JSON fixture 兼容性测试。
- 离线事件跨队列重建恢复、重复事件去重、失败后重试、ACK 后持久清除。
- 队列上限、24 小时过期和无权限事件清理。
- 训练时间推导、阶段边界单次调度、蹲会儿 haptic 边界单次调度。
- 前台重试按 5、10、20、30 秒退避，后台不调度轮询。
- Watch App 与 Complication 在 watchOS 模拟器构建成功。
- 配对模拟器连接成功，Watch App 启动后收到 iPhone 低敏状态并正确显示首页。

仍需真机：

- 离线操作后的真实蓝牙重连与双向同步。
- 训练和蹲会儿 haptic 强度及每阶段只触发一次的体感确认。
- 三类 Complication 的表盘展示、过期态、Pro 锁定态、深链和系统刷新节奏。
- iPhone/Watch 前后台切换与配对稳定性。

本次三次真机构建均已识别 Apple Watch Series 10，但设备要求解锁并靠近 Mac，Xcode 等待设备准备超时，因此不将真机项标记为通过。最近一次签名构建仍返回相同的设备准备错误，证明阻塞来自当前设备状态，而不是 Watch scheme 或项目编译配置。

## Live Activity

状态：未完成真机验收。

代码级重启恢复已补齐并通过自动化验证：App 启动时等待设置与计时会话完成持久化恢复，再枚举原生 Activity；恢复过程会重新关联有效 ID、在 ID 丢失时复用或重建 Activity、清理重复或孤儿 Activity，并在用户同时开始新计时或状态变化时执行尾随协调。7 项恢复测试覆盖持久化等待、孤儿清理、禁用清理、清理与新会话竞态、会话切换竞态、瞬时失败保留 ID，以及原生不支持时清除旧 ID；包含 Live Activity extension 和 Expo Module 的 `app` scheme 重新编译通过。

配对 iPhone 15 Pro Max 当前不可用，尚未取得签名安装、启动、更新、结束和 App 终止后重启恢复的真机视觉证据。模拟器编译与代码级测试不能替代这一验收，因此该项继续保持未完成。

## 当前门禁

2026-07-14 已通过：

- `pnpm check`：类型、lint、格式、单元测试、OpenAPI 漂移和真实 iOS bundle 全部通过。
- Contracts：5 个测试文件、99 项测试通过。
- API：真实 PostgreSQL 下 14 个测试文件、61 项测试通过。
- 移动端：14 个测试文件、47 项测试通过；XCUITest smoke 与双用户关键流程通过。
- Expo dependency check：本地依赖映射检查通过。
- `app`、`XiaoTiduWatchApp`、`XiaoTiduWatchComplications` 三个 Xcode scheme 构建通过。
- Watch protocol fixture 与 queue/timeline Swift 测试通过。

### 版本一致性补审

完成度审计发现主 App、Live Activity、Watch App 与 Complication 的 Xcode build setting 仍为 `0.1.0`，主 App plist 也硬编码旧版本。现已统一为 `0.2.0`，重新构建后四个实际产物的 `CFBundleShortVersionString` 均读出 `0.2.0`。所有 iOS plist 均从 `MARKETING_VERSION` 取值，OpenAPI 改为复用 API 版本常量；根 `pnpm versions:check` 会同时检查 package、podspec、Expo、API、Xcode 和 plist，后续漂移会直接阻断 `pnpm check`。

Xcode 输出的警告来自当前 Expo/React Native Pods，未出现项目源码编译错误。

## 剩余 P1

真机逐项执行、证据留痕和 P2 发布能力范围统一使用[真机验收总清单](./physical-device-acceptance-checklist.md)。

1. 解锁 Apple Watch，并让配对 iPhone 与 Watch 靠近 Mac 后完成 Watch 真机清单。
2. 连接并解锁 iPhone 真机，完成 Live Activity 真机清单。
3. 真机项通过后运行最终全仓门禁并在本文追加最终结果。
