# Watch 协议

当前状态协议为 `schemaVersion: 6`，事件协议为 `schemaVersion: 4`。iPhone 与 Watch 同步更新，不接受旧格式。

## 状态与事件归属

`WatchTodayState.account.owner` 在已登录时包含 `userId` 和 `profileId`；匿名态为 `null`。`canUseActions` 表示操作权限。计时状态增加 `toilet.sessionId`，无活动计时时为 `null`。

所有 `watch_event` 包装的事件包含唯一 `id`、`createdAt`、`owner`、类型和最小 payload。计时操作额外包含 `sessionId`。入队后保留原账号和计时标识，换号不能改写事件归属；队列只发送当前 owner 的事件，其他账号的待发送项继续按原归属保留。习惯清除在 Swift 消息中省略 `level`（WCSession property list 不接受 `NSNull`），手机解析后规范为 `null`。iPhone 校验完整字段、数值范围、事件年龄（最多 24 小时，允许时钟超前 5 分钟）、账号和计时目标。

小账本 `*Done` 布尔值表示已有记录，界面显示“已记录”，不能理解为 `good` 或健康达标。手机填写 `low`、`medium`、`good` 或排便专用的 `not_today` 都会显示已记录。Watch 空项按界面所示分档快捷填写 `good`，已有记录再次点击清除；其他分档和“今日未排便”在手机选择。此处不增加状态协议字段。

## 保存与回执

| ACK | 含义 | Watch 行为 |
| --- | --- | --- |
| `accepted` | 本次保存已提交 | 移除队列事件，显示确认保存 |
| `duplicate` | 相同 ID、相同内容的事件已提交 | 移除队列事件，不重复记账 |
| `retryable` | 存储、会话恢复等暂时失败 | 保留原事件，稍后重试 |
| `rejected` | 账号/计时不匹配、非训练操作权限拒绝、过期、内容非法等永久拒绝 | 显示失败并移除事件，不换账号重放 |

必须同时匹配 `eventId` 才承认回执；传输成功、未知状态、回执 ID 不匹配或 15 秒内未确认，均不能删除事件。迟到的旧发送回调不覆盖新尝试。

训练、习惯和排便记录与同步 outbox、每日汇总、Watch 去重回执在同一 SQLite 事务提交，失败整体回滚。`watch_event_receipts` 按 profile/事件 ID 唯一，并比较规范化内容；在处理新事件时清理超过 48 小时的回执。重复事件不会覆盖之后的习惯修改。

计时暂停/继续使用 KV 存储，成功回执前等待持久化。KV 与 SQLite 不是跨库原子事务：动作按计时 ID 幂等，失败重放继续完成。结束计时先提交记录，再清除匹配的计时；清除失败返回 `retryable`，重放通过已提交回执补做清除，不重复记录、不清除新计时。Live Activity、通知和统计刷新失败不撤销已经提交的健康记录。

## 队列与更新

实时、离线事件统一先写入 Watch 队列，再逐条发送。队列最多 25 条、保留 24 小时，超限移除最早项、过期项清理；不能据此承诺无限期保存。临时不可用或尚未恢复账号状态只暂停发送，不清空队列。前台重试按 5、10、20、30 秒退避，后台不持续轮询。

iPhone 通过 `apps/mobile/modules/watch-connectivity` 本地 Expo Module 暴露接口；NSObject client 持有 WCSession delegate 与待回复消息。TypeScript 和 Swift 共用 `apps/mobile/fixtures/watch-today-state-v6.json` 验证状态格式和隐私字段。训练按明确的准备、收缩、放松、暂停、结束状态推进；显示刷新不推进阶段。活动时间使用单调时钟，真实开始/结束日期单独保存。

自动化证据与未覆盖边界见 [R08 保存与回执验收](./save-ack-acceptance.md)。R04 的训练归属与状态顺序回归见[本轮记录](./sync-device-service-boundaries-acceptance.md)，配对真机仍待验收。

## 状态顺序与动作起点

状态 v6 带有 `revision`。iPhone 每次构建快照前，在本地 KV 中同步分配并保存递增序号，跨账号、进程重启和时钟回拨保持顺序。Watch 持久化最近快照，仅接受更大的 revision；主动推送、刷新响应和 ACK 中的状态遵循同一规则。重新安装 iPhone 应用导致本地资料整体重置时，需同时重置/重新配对 Watch 缓存；不迁移旧开发版本状态。

训练 session 在开始时固定 owner，换号会暂停并按原 owner 保留未完成草稿，切回原账号后恢复为暂停状态；即使旧定时回调已到达，发送入口也拒绝将其归给新账号。手机计时在开始时保存 owner，Watch 快照仅暴露当前账号拥有的计时，执行与重复事件清理都核对 owner 和 sessionId。

## 训练状态 v6 / 事件 v4

`training.target` 为 `null | 1 | 2`，默认 `null`，此时 `done` 为 false。`completedSets` 仅指当天完整组数；训练事件不再使用这个字段表达重复次数。`trainingModes` 包含三个经过范围校验的模式，使用手机当前资料的设置；设置尚未加载时 `canUseActions` 为 false。活动训练固定开始时的参数，不跟随中途同步改变。

训练事件类型是 `training_finished`，`payload.session` 包含：

- `id`：与事件 ID 相同，前缀 `watch-`，入队和重试保持不变；事件 `createdAt` 固定为本次 `endedAt`。
- `presetId`、`plan: { contractSeconds, relaxSeconds, repetitions }`：开始时的参数快照。
- `startedAt`、`endedAt`：真实日期；`durationSeconds`：有效活动秒数，排除准备与暂停，可能因暂停重做超过计划总时长。
- `completedRepetitions`、`isCompleted`：仅完整收缩—放松循环计数；允许部分完成记录。
- `feedback: unanswered | none | reported`、`endReason: completed | user_stopped | discomfort | interrupted`。

停止时先冻结并持久化草稿，再选择反馈；首次尝试提交时锁定反馈，失败或重启后复用原 ID、内容和结束时间。离开结果页也提交已有草稿，默认未反馈。同账号权限不可用时暂停训练，未入队草稿保留；手机收到该账号训练事件但权限暂不可用时返回 `retryable`，不能跨账号保存。离线队列的 24 小时保留上限仍适用。

恢复规则：冷启动始终暂停；旧日期进度只能保存为未完成记录或放弃。进入非 active 状态取消阶段任务并暂停。继续先完整放松，之前完整收缩的一次在放松结束后计入；被中断的收缩不计入。确认结束期间不推进阶段或自动保存。

## 一次性升级

- SQLite v5 与 Postgres `0002` 将旧布尔反馈转换为三态，按原预设回填参数；旧 false 转未反馈，true 转有不适。只修正 ID 为 `watch-` 前缀、完整标记且实际时长等于原计划的“1 组写成 1 次”记录；无法确认的历史不猜改，历史开始时间保持原值。
- 同步升级已有 outbox 和云端 change payload。旧手机计时检查点转成冻结的待保存记录，不能接着旧时间轴训练。
- Watch 首次读取旧离线队列时升级到 v4，保留事件归属；旧训练事件转换为按旧数据可确定的记录，已存在记录使用相同记录 ID 去重。手机已处理的习惯/计时回执同步升级版本，避免重试被视为不同内容。
- 在线解析器仅接受状态 v6 与事件 v4，无旧协议运行时回退。不清空用户数据库。手机和 Watch 需一起更新。

详细自动化证据和待验收项目见[训练修复验收](./training-safety-acceptance.md)。
