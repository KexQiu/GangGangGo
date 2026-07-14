# 真机验收总清单

本文集中管理所有不能以模拟器、单元测试或 Xcode 编译替代的验收项。它是当前 iPhone / Apple Watch 真机验收的唯一汇总入口；原有手动清单保留为具体操作参考。

范围说明：

- `P1` 是当前代码已具备、合并 P1 前必须取得真机证据的能力。
- `P2` 依赖 Apple Developer Program、生产证书或尚未实现的商业化功能；不得提前勾选。
- Android 完整真机验收属于 P3，当前没有 Android 产品实现，故不在本清单内。
- 常规 UI、API、SQLite 迁移、Watch 协议和原生编译由自动化门禁覆盖，不因本清单重复标记为真机通过。

## 使用方式

每一轮执行先填写环境，再只勾选已在真实设备上观察到预期结果的项目。失败、阻塞或豁免必须在对应分组的“结果与证据”中记录日期、设备、系统版本、构建号和问题链接。

- [ ] 执行记录已填写日期、执行人、App commit / build 号。
- [ ] 已填写 iPhone 型号、iOS 版本、签名 profile 和测试账号。
- [ ] 已填写 Apple Watch 型号、watchOS 版本、配对 iPhone 和测试账号。
- [ ] 已将截图、录屏、Xcode device log 或问题链接写入本轮结果。

当前已知阻塞：配对 iPhone 15 Pro Max 处于不可用状态；Apple Watch Series 10 虽被识别，但需要解锁并靠近 Mac 才能完成设备准备。详见 [P1 验收记录](./p1-acceptance-2026-07-14.md)。

## P1：iPhone 真机

### 设备与数据边界

所需设备：至少一台可签名、已解锁的 iPhone；涉及灵动岛时使用支持 Dynamic Island 的机型；涉及锁屏兼容性时使用一台 iOS 16.1+ 的非 Dynamic Island 机型。

- [ ] 使用 development build 或正式包安装 App；不使用 Expo Go 验收原生能力。
- [ ] App 在真机首次启动、退到后台、强制结束并重新启动后均能正常进入本地功能。
- [ ] 登录会话在强制结束并重启后按预期恢复；退出登录后云端会话清除，而本地训练、蹲会儿和小账本记录仍保留。
- [ ] 使用 Xcode 的真机 App Container 确认 SQLite 主文件、WAL 和 SHM 已应用文件保护，并被排除在 iCloud 备份之外。
- [ ] 锁定并重新解锁设备后，本地健康记录仍可读取；未出现数据库不可用或数据丢失。

结果与证据：待填写。

### 本地通知、震动与音效

所需设备：真实 iPhone。系统通知权限、锁屏通知、触感、静音模式和音频会话不可只以模拟器判断。

- [ ] 首次请求通知权限时，系统授权面板的文案和行为正常。
- [ ] 允许通知后，小暗号和蹲会儿阶段通知能在 App 后台或锁屏时出现。
- [ ] 拒绝通知后，提醒设置仍可保存，App 不崩溃且不再尝试显示本地通知。
- [ ] 小暗号每日提醒与久坐提醒按当前设置注册；修改设置后旧提醒被取消，新提醒按最新时间生效。
- [ ] 蹲会儿在后台时只安排尚未到达的 5、10、15、20 分钟阶段通知。
- [ ] 暂停、收工、放弃或回到前台后，未触发的蹲会儿阶段通知被取消。
- [ ] 锁屏和通知中心文案不暴露敏感健康细节，且本地通知不播放声音。
- [ ] 菊花抬完成、小账本满格和蹲会儿开始/暂停的 iPhone 震动符合预期。
- [ ] 蹲会儿前台阶段切换在 5、10、15、20 分钟各触发一次触感；关闭阶段音效后不播放音频。
- [ ] 系统静音或音量状态下，阶段音效和触感表现符合 iOS 系统策略，不影响计时主流程。

结果与证据：待填写。

### Live Activity / 灵动岛

所需设备：iOS 16.1+ 真机 development build 或正式包。Dynamic Island 展示需支持该硬件的 iPhone；锁屏展示需在锁屏状态观察。

- [ ] 默认关闭灵动岛计时；开启设置后开始蹲会儿会创建 Live Activity。
- [ ] 支持 Dynamic Island 的 iPhone 在灵动岛显示低敏计时、阶段和状态。
- [ ] iOS 16.1+ 非 Dynamic Island iPhone 在锁屏显示同一 Live Activity；如无此设备，明确记录为兼容性阻塞。
- [ ] 暂停、继续和阶段变化会更新 Live Activity，计时不会从 `0:00` 错误重置。
- [ ] 点击灵动岛或锁屏 Live Activity 能回到蹲会儿页面。
- [ ] 收工和放弃后 Live Activity 立即结束，不残留在灵动岛或锁屏。
- [ ] App 强制结束后重新启动：活动计时能重新关联、恢复当前状态，且不会创建重复 Activity。
- [ ] 在原生活动 ID 丢失、旧活动残留或用户在恢复期间新开计时时，最终只保留当前会话对应的一个 Activity。
- [ ] 关闭灵动岛计时或系统禁用此 App 的 Live Activity 后，不再创建活动且旧活动被清理。
- [ ] 灵动岛和锁屏内容不出现具体时长以外的敏感健康详情、便血、不适或排便感受。

结果与证据：待填写。

### iOS 系统交接

所需设备：真实 iPhone；分享扩展、Safari / 系统深链和后台恢复须以系统环境确认。

- [ ] 从邀请页调起系统分享面板，并通过真实分享目标发送邀请链接。
- [ ] 从 Safari、信息或已分享链接打开邀请，App 正确进入邀请预览或登录后的接受流程。
- [ ] 从外部链接返回 App 后，不显示上一个账号的云端缓存；本地健康记录仍保留。
- [ ] 提醒线程在前台且页面聚焦时刷新；切到后台或离开页面后不继续进行前台轮询。

结果与证据：待填写。

## P1：Apple Watch 真机与配对 iPhone

所需设备：一台已解锁、靠近 Mac 的真实 Apple Watch，及其已解锁、已配对、可签名的 iPhone。Watch haptic、真实配对、后台重连和表盘 Complication 不能由模拟器代替。

### 安装、连接与权限

- [ ] Xcode 将 `app`、`XiaoTiduWatchApp` 和 `XiaoTiduWatchComplications` 安装到真实配对设备。
- [ ] iPhone `/watch` 显示支持、已配对和 Watch App 安装状态正确。
- [ ] Watch App 可启动且不显示底层英文错误；开发构建才显示连接诊断，生产构建不显示 JSON、ACK 或底层字段。
- [ ] Pro、Pro 宽限期、免费、已过期和未登录状态下，Watch 权限分别符合预期。
- [ ] Watch 始终只展示低敏状态，不展示便血、不适、排便感受或具体风险详情。

结果与证据：待填写。

### iPhone 与 Watch 双向同步

- [ ] iPhone 修改小账本四项达标状态后，Watch 在 5 秒内显示对应状态和完成度。
- [ ] Watch 小账本打卡与撤销后，iPhone 首页同步更新，Watch 收到成功 ACK。
- [ ] iPhone 开始、暂停、继续、收工或放弃蹲会儿后，Watch 状态、计时和阶段在 5 秒内正确变化。
- [ ] Watch 暂停、继续和收工蹲会儿后，iPhone 计时、记录和阶段通知正确收敛；收工后 iPhone Live Activity 不残留。
- [ ] Watch 完成菊花抬后，iPhone 训练记录和 Watch 首页状态同步更新。
- [ ] Watch 训练模式时长与 iPhone 下发配置一致；短暂卡顿后计时追上真实时间且不累计漂移。
- [ ] 同一离线事件重复发送时，不产生重复训练、小账本或蹲会儿记录；Watch 显示可理解的成功或重复反馈。
- [ ] 非法、过期或无 Pro 权限事件被 iPhone 拒绝时，Watch 显示中文错误且不写入新记录。

结果与证据：待填写。

### 离线、重连与生命周期

- [ ] iPhone 不可达时，Watch 操作进入离线队列，Watch 不崩溃。
- [ ] 恢复 iPhone / Watch 可达后，队列自动补发，成功事件清除且 iPhone 状态更新。
- [ ] 离线队列重启恢复、24 小时过期和 25 条上限在真实设备上行为正确。
- [ ] iPhone 与 Watch 前后台切换、锁屏和重新打开后，连接可恢复且没有重复写入。
- [ ] Watch 前台首次失败后的重连遵循退避；后台不持续轮询或明显耗电。

结果与证据：待填写。

### Watch haptic 与视觉体验

- [ ] 菊花抬收紧、放松、完成和中止的 haptic 节奏可区分、不连续强震且 Watch 不播放音效。
- [ ] 蹲会儿 5、10、15、20 分钟阶段 haptic 各触发一次；暂停、恢复或前后台切换后不重复触发。
- [ ] 蹲会儿各阶段的 haptic 强度能区分轻提醒与强提醒，体感不会过密或打扰。
- [ ] 小屏 Apple Watch 上首页、菊花抬、小账本、蹲会儿和确认操作没有文字拥挤、截断或误触。
- [ ] 断开连接、未安装 Watch App、免费/过期和拒绝 ACK 等错误态在真机上显示可理解反馈。

结果与证据：待填写。

### Complication

- [ ] 将 Complication 添加到真实表盘的 circular、rectangular 和 inline 三种 family。
- [ ] 普通状态显示低敏小账本完成度或菊花抬状态，内容清晰且不泄露敏感详情。
- [ ] 状态过期或尚未同步时显示“打开同步”提示。
- [ ] Pro 用户蹲会儿进行中时，Complication 显示计时状态并深链到 Watch 蹲会儿页。
- [ ] 非 Pro、过期和未登录状态显示锁定态，点击不进入可操作页面。
- [ ] 从表盘点击普通状态能进入 Watch 首页。
- [ ] Watch 状态变化后，Complication 以系统允许的刷新节奏更新；记录实际延迟与系统限制。

结果与证据：待填写。

## P2：Apple Developer 与发布前真机验收

以下项目不阻塞当前 P1 代码合并。它们依赖 Apple Developer Program、生产签名或尚未实现的功能；功能和凭证准备完成后，仍必须使用真实设备执行。

### Sign in with Apple

所需设备：配置 Sign in with Apple capability 的真实 iPhone development、TestFlight 或生产构建。

- [ ] 系统 Apple 授权面板正常出现，成功授权后 App 显示正确用户与权益。
- [ ] 取消授权不改变当前会话，也不产生未处理错误。
- [ ] 重装、再次登录和 Apple 返回首登仅一次的姓名 / 邮箱字段时，账户关联保持正确。
- [ ] 后端拒绝伪造、过期或 bundle ID 不匹配的 identity token，真机用户不会被错误登录。

结果与证据：待功能与 capability 就绪后填写。

### 远程 Push

所需设备：至少两台真实 iPhone、两个测试账号、带 `aps-environment` entitlement 的签名包及可用的 Push 服务。

- [ ] 两台设备均可获取 Push token，并成功注册到服务端。
- [ ] A 向 B 发起搭子提醒后，B 在后台和锁屏都收到低敏远程通知。
- [ ] B 提交回执后，A 收到对应远程通知。
- [ ] 点击通知会进入正确的提醒线程或目标页面；前台收到通知不破坏当前操作。
- [ ] 拒绝通知权限、移除 App 或失效 token 时，主业务仍可用，服务端停止持续投递失效 token。
- [ ] development、preview、production 三种签名包的 APNs 环境与实际投递环境一致。

结果与证据：待 Push 功能、证书和双设备环境就绪后填写。

### StoreKit 与订阅生命周期

所需设备：真实 iPhone、沙盒 Apple ID 或 TestFlight、已配置 App Store Connect 商品和后端验证能力。

- [ ] 真实价格、周期和恢复购买入口在设备上正确显示。
- [ ] 沙盒购买成功后，App 和服务端权益变为 `pro_active`。
- [ ] 恢复购买能恢复既有权益，不产生重复订阅记录。
- [ ] 取消续订、宽限期、到期、退款和重新订阅后，权益与小队 / Watch / 报告限制按产品规则切换。
- [ ] App Store Server Notification 到达后，真机权益在合理时间内更新；网络失败不会错误授予权益。

结果与证据：待 StoreKit 与服务端能力就绪后填写。

### TestFlight / 生产包

所需设备：至少一台 iPhone、如发布 Watch 则一台配对 Apple Watch；使用 preview 或 production 签名包。

- [ ] TestFlight 或生产包可安装、升级和启动，版本号与发布记录一致。
- [ ] 生产包不展示 mock 用户入口、Watch 调试 JSON、ACK、bundle 信息或事件日志。
- [ ] 生产包的 Apple 登录、Push、订阅、Live Activity、Watch 和 Complication 分别按本清单已完成的条件复测。
- [ ] 锁屏、通知中心、灵动岛、Watch 表盘和系统设置中的内容均符合隐私边界。

结果与证据：待发布候选包就绪后填写。

## 关联文档

- [P1 验收记录](./p1-acceptance-2026-07-14.md)：当前 P1 自动化、模拟器和真机证据。
- [Apple Watch 手动测试清单](../v0.2/apple-watch-manual-test-checklist.md)：Watch 页面和双向操作的详细步骤。
- [移动端后端联调手动测试清单](../v0.2/mobile-backend-manual-test-checklist.md)：双用户、邀请、共享、登录和 Push 的详细步骤。
- [Architecture v2 后续待办](./architecture-v2-follow-up-todo.md)：P1 / P2 范围与当前优先级。
- [隐私与数据边界](./privacy-boundaries.md)：本地文件保护、备份排除和健康数据边界。
