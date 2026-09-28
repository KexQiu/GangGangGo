# 上线前数据库基线

2026-09-28：项目尚未上线，SQLite 与 PostgreSQL 的开发期迁移已合并为当前结构的初始基线。旧报告快照表、旧提醒单时段字段和已经移除的小队表不再进入新库。

## 移动端

- 当前文件为 `xiaotidu-v1.db`，当前 `user_version` 为 `2`。版本 1 是清理后的初始基线；版本 2 增加 Watch 持久化去重回执，保留当前开发库数据。
- 首次打开时，在一个事务中创建当前表、索引和匿名数据 profile；重复初始化不改动已有记录。
- 不自动导入或删除旧开发文件 `xiaotidu.db`。运行新版后，本地记录从新库开始；登录后按当前同步机制拉取云端数据。
- 需要保留旧测试记录时，先备份旧文件及 WAL/SHM，或在切换前导出；基线没有提供旧结构升级流程。
- 后续正式版本仍通过 `runMigrations` 增加迁移，不能在上线后反复改写初始基线。

## PostgreSQL

`apps/api/drizzle/0000_initial.sql` 和对应快照、journal 是新的迁移起点。它们只用于空库，不可在执行过旧 `0000`–`0006` 的数据库上直接继续迁移。

开发环境切换时，创建一个独立的空数据库，将 `DATABASE_URL` 指向该数据库，再执行：

```sh
pnpm --filter @xiaotidu/api db:migrate
```

旧数据库保留，按需要单独备份或处理。本次仓库清理不会自动清空、删除或迁移已有开发数据库。

以后修改 Drizzle schema 时，正常生成增量迁移，不再压缩已发布的迁移历史：

```sh
pnpm --filter @xiaotidu/api db:generate
```

## 验证

- SQLite：`pnpm --filter @xiaotidu/mobile test` 覆盖空库建表、版本 1 增量升级、重复初始化、失败回滚、未知版本拒绝，以及匿名数据归属与同步队列。
- PostgreSQL：在独立测试数据库上执行基线迁移，再以该库的 `DATABASE_URL` 运行 `pnpm --filter @xiaotidu/api test`；未配置数据库时 PostgreSQL 集成测试会跳过。
