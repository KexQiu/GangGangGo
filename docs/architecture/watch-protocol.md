# Watch 协议

当前状态协议版本为 `schemaVersion: 3`。iPhone 下发低敏 `WatchTodayState`，并通过 `canUseActions` 明确表示当前账号能否执行手表操作，不再携带 `proStatus`。Watch 事件仍使用 v2 事件结构，包含事件 ID、创建时间、类型和最小 payload；iPhone 返回 accepted、duplicate 或 rejected ACK。

Watch 以 WCSession 推送为主，只在前台失败后按 5、10、20、30 秒退避重试。训练和蹲会儿显示以真实时间推导并按 1 Hz 刷新，后台不保留轮询。离线队列最多 25 条、保留 24 小时，并按事件 ID 去重。

iPhone 侧 WatchConnectivity 通过 `apps/mobile/modules/watch-connectivity` 本地 Expo Module 暴露类型化接口。Expo Module 只负责 JS API 和事件，独立 `NSObject` client 持有 WCSession delegate 与待回复消息；TypeScript 和 Swift 使用同一份 `fixtures/watch-today-state-v3.json` 做协议与隐私边界验证。Swift 只接受明确带有 `schemaVersion: 3` 和 `canUseActions` 的状态；iPhone 只接受 `watch_event` 包装的 v2 事件。旧状态推导和 Watch 旧存储双写已移除，离线占位状态仍保留。
