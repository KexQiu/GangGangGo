# 认证会话

API 使用 `jose` 签发 15 分钟 access token，JWT 包含用户 ID 与服务端 `sessionId`。30 天 refresh token 只在创建时返回，数据库仅保存 SHA-256 摘要；刷新时旧 session 被撤销并轮换新 token。

移动端使用 SecureStore 保存会话。请求遇到 401 时只尝试刷新一次，失败后清除云端会话和 Query 缓存，不清理 SQLite 健康记录。Mock Apple 登录仅允许非生产环境。
