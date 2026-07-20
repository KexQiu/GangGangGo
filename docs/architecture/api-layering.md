# API 分层与 OpenAPI 单一来源

- 状态：已采用
- 日期：2026-07-13
- 范围：`apps/api`、`packages/contracts`、`docs/v0.2/openapi.json`

## 背景

早期 API service 同时负责业务编排、Drizzle 查询和并发规则，接口 schema 与 OpenAPI operations 又在生成脚本中重复登记。随着小队、提醒、认证会话和报告链路增长，这种结构难以独立测试，也容易让实现、共享类型和文档漂移。

## 决策

每个 API 领域采用以下职责边界：

- route：声明 HTTP 方法、路径、鉴权、共享 Zod 请求/响应 schema，并把有效输入交给 service。
- service：编排用例、事务和跨 repository 调用，不直接构造 Drizzle 查询。
- repository：只负责数据库读取、写入和事务作用域适配。
- policy：保存无数据库依赖的业务规则，例如小队容量、单用户单小队、提醒额度与回执修改窗口。
- mapper：将数据库行或领域结果转换为 contracts DTO。

`packages/contracts` 按 common/auth/users/teams/nudges/reports/push/subscriptions 拆分，Zod schema 是运行时校验与 TypeScript 类型的共同来源。Hono OpenAPI 注册表直接读取 route 和共享 schema 生成 `api-reference.md` 与 `openapi.json`；生成脚本不再维护第二份 operations 清单。

并发不变量由数据库和事务共同保证：认证 refresh session 轮换、单用户单小队部分唯一索引、接受邀请时 team 行锁与事务内重检、每日提醒计数原子递增、回执条件 upsert/update。报告批量上传使用一次 bulk upsert，7/30/90 天汇总在读取时计算。

## 结果

- 新增接口时必须同时完成 route schema、service 用例和必要的 repository/policy 测试。
- route 不承载业务分支，service 不包含 Drizzle 查询，policy 不访问数据库。
- 共享 schema 变更会同时影响 API、移动端运行时解析、OpenAPI 快照和漂移检查。
- 真实 Postgres 集成测试负责证明事务、索引、并发和查询次数；mock 测试不能替代这些门禁。
- `docs/v0.2/openapi.json` 与 `api-reference.md` 是生成物，不手工编辑。
