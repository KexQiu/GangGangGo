# 隐私与数据边界

本地 SQLite 可以保存训练记录、具体蹲会儿时长、感受、便血和不适信息。云端共享快照仅允许日期、训练是否达标、小账本完成度、是否记录过蹲会儿和连续天数。

个人高级报告额外允许“是否长会”这一日级布尔值，但不进入小队共享。contracts 使用 strict Zod schema 拒绝额外字段。日志不得包含 token、健康详情或完整 Watch payload。

iOS 在 SQLite 初始化后通过 `apps/mobile/modules/storage-protection` 设置 `completeUntilFirstUserAuthentication` 文件保护，并对数据库目录、主文件、WAL 和 SHM 标记 iCloud 备份排除。
