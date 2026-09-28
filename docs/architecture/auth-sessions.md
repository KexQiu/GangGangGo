# 认证会话

API 使用 `jose` 签发 15 分钟 access token，JWT 包含用户 ID 与服务端 `sessionId`。30 天 refresh token 只在创建时返回，数据库仅保存 SHA-256 摘要；刷新时旧 session 被撤销并轮换新 token。

移动端由 `SessionContext` 管理不可变的会话快照：`generation`、`userId`、`profileId` 和 `accessToken`。登录、退出及恢复开始时立即使旧代次失效，身份尚未确定时暂停云端请求。普通 token 轮换沿用当前代次；已发请求仍绑定原身份，不能借新账号的凭证重发。

SecureStore 在同一个值中保存用户、profile ID 和凭证。恢复时先验证 SQLite 中 profile 的用户归属，再发布会话，网络不可用时仍能访问原有本地记录。此格式属于上线前基线，不迁移旧开发会话；更新后的首次运行需重新登录。

请求遇到符合 API 契约的 `401 unauthorized` 时最多刷新并重发一次。同一代次的刷新合并为一个请求；延迟到达的旧 token 401 可使用本会话已经轮换的 token。每次发送、重试和接收响应都检查原身份。网络、超时、服务端暂时错误及无效响应保留会话与本地资料，记录可恢复错误，后续同步或用户重试可再次续期；只有明确的凭证失效才清除当前会话和云端缓存。

SecureStore 写入/删除、本地 profile 切换及同步响应落库共用本地副作用队列，网络请求不占用队列。旧代次的排队操作取消；已经开始的本地写入先完成，随后才切换 profile。退出立即使本地会话失效，并异步尝试撤销原远端会话；旧撤销请求不能刷新或清除新账号。SQLite 健康记录保持保留。设备 Push 绑定服务端 session，令牌轮换时迁移绑定，投递查询同时验证会话归属、撤销状态和有效期。

Mock Apple 登录仅允许非生产环境。自动化证据见[会话归属回归记录](./session-ownership-acceptance.md)；真机与真实 Apple 登录验收仍需单独执行。

## 设备退出与离线补偿

每次登录创建独立 `familyId`，refresh 轮换沿用该 family；退出撤销本 family，不影响同账号其他设备的独立登录。注册 Push 要求 `deviceId` 并绑定已认证 `sessionId`。`DELETE /push-tokens/{deviceId}` 只撤销当前用户、设备、会话匹配的绑定；旧账号的迟到操作不能关闭新账号绑定。

移动端清除 SecureStore 会话前，先将原 refresh token、账号和本地清理状态放入独立 SecureStore 撤销队列。完成本地凭证删除后才把任务标为可发送，避免远端 ACK 先删除本地退出标记。`POST /auth/revoke` 仅用请求中的原凭证定位并撤销 family，不使用新账号 token，也不能刷新登录。网络失败保留队列；启动、回到前台、前台每 60 秒以及下次注册 Push 时重试。恢复时发现当前凭证仍在撤销队列，会先完成本地退出。

已轮换的旧 refresh 摘要保留到过期，作为撤销凭证；不能用于再次刷新。轮换与撤销使用同一 family 的事务锁，避免旧凭证的退出漏掉正在创建的新 session。轮换时将旧行保留期延至本次轮换后 30 天，清理任务仅移除过期行。

离线撤销尚未到达服务端时，服务端无法立即得知本地退出；已开始投递（已读取绑定）或已提交给推送平台的通知也无法撤回。本轮验证发送前的有效绑定过滤和撤销补偿，真实 APNs/Expo 投递仍需设备验收，见[本轮记录](./sync-device-service-boundaries-acceptance.md)。
