# Watch 协议

当前状态协议为 `schemaVersion: 5`，事件协议为 `schemaVersion: 3`。iPhone 与 Watch 同步更新，不接受旧格式。

## 状态与事件归属

`WatchTodayState.account.owner` 在已登录时包含 `userId` 和 `profileId`；匿名态为 `null`。`canUseActions` 表示操作权限。计时状态增加 `toilet.sessionId`，无活动计时时为 `null`。

所有 `watch_event` 包装的事件包含唯一 `id`、`createdAt`、`owner`、类型和最小 payload。计时操作额外包含 `sessionId`。入队后保留原账号和计时标识，换号不能改写事件归属。习惯清除在 Swift 消息中省略 `level`（WCSession property list 不接受 `NSNull`），手机解析后规范为 `null`。iPhone 校验完整字段、数值范围、事件年龄（最多 24 小时，允许时钟超前 5 分钟）、账号和计时目标。

## 保存与回执

| ACK | 含义 | Watch 行为 |
| --- | --- | --- |
| `accepted` | 本次保存已提交 | 移除队列事件，显示确认保存 |
| `duplicate` | 相同 ID、相同内容的事件已提交 | 移除队列事件，不重复记账 |
| `retryable` | 存储、会话恢复等暂时失败 | 保留原事件，稍后重试 |
| `rejected` | 账号/计时不匹配、权限拒绝、过期、内容非法等永久拒绝 | 显示失败并移除事件，不换账号重放 |

必须同时匹配 `eventId` 才承认回执；传输成功、未知状态、回执 ID 不匹配或 15 秒内未确认，均不能删除事件。迟到的旧发送回调不覆盖新尝试。

训练、习惯和排便记录与同步 outbox、每日汇总、Watch 去重回执在同一 SQLite 事务提交，失败整体回滚。`watch_event_receipts` 按 profile/事件 ID 唯一，并比较规范化内容；在处理新事件时清理超过 48 小时的回执。重复事件不会覆盖之后的习惯修改。

计时暂停/继续使用 KV 存储，成功回执前等待持久化。KV 与 SQLite 不是跨库原子事务：动作按计时 ID 幂等，失败重放继续完成。结束计时先提交记录，再清除匹配的计时；清除失败返回 `retryable`，重放通过已提交回执补做清除，不重复记录、不清除新计时。Live Activity、通知和统计刷新失败不撤销已经提交的健康记录。

## 队列与更新

实时、离线事件统一先写入 Watch 队列，再逐条发送。队列最多 25 条、保留 24 小时，超限移除最早项、过期项清理；不能据此承诺无限期保存。临时不可用或尚未恢复账号状态只暂停发送，不清空队列。前台重试按 5、10、20、30 秒退避，后台不持续轮询。

iPhone 通过 `apps/mobile/modules/watch-connectivity` 本地 Expo Module 暴露接口；NSObject client 持有 WCSession delegate 与待回复消息。TypeScript 和 Swift 共用 `apps/mobile/fixtures/watch-today-state-v5.json` 验证状态格式和隐私字段。训练与计时显示仍以真实时间推导并按 1 Hz 刷新。

自动化证据与未覆盖边界见 [R08 保存与回执验收](./save-ack-acceptance.md)。R04 的训练归属与状态顺序回归见[本轮记录](./sync-device-service-boundaries-acceptance.md)，配对真机仍待验收。

## 状态顺序与动作起点

状态 v5 带有 `revision`。iPhone 每次构建快照前，在本地 KV 中同步分配并保存递增序号，跨账号、进程重启和时钟回拨保持顺序。Watch 持久化最近快照，仅接受更大的 revision；主动推送、刷新响应和 ACK 中的状态遵循同一规则。重新安装 iPhone 应用导致本地资料整体重置时，需同时重置/重新配对 Watch 缓存；不迁移旧开发版本状态。

训练 session 在开始时固定 owner，换号会清除未完成的训练展示；即使旧定时回调已到达，发送入口也拒绝将其归给新账号。手机计时在开始时保存 owner，Watch 快照仅暴露当前账号拥有的计时，执行与重复事件清理都核对 owner 和 sessionId。
