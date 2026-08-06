# API 分层与 OpenAPI 单一来源

- 状态：已采用
- 更新日期：2026-08-06
- 范围：`apps/api`、`packages/contracts`、`docs/v0.2/openapi.json`

## 决策

API 保持 Hono + Drizzle 模块化单体，不引入额外框架。稳定入口链路为：

```text
server.ts -> app.ts/createApiApp -> registerRoutes -> domain route/service
```

各职责如下：

- route：声明 HTTP 方法、路径、鉴权、共享 Zod schema，并交给领域服务。
- service：编排用例、事务和跨领域调用；复杂域可直接持有集中后的 Drizzle 实现，但不得同时混入 Mock、DTO 映射和纯策略。
- repository：适用于查询边界稳定、可复用或需要单独统计查询次数的领域。
- policy：保存无数据库依赖的限额、时间、权限与投影规则。
- mapper：将数据库行或领域结果转换为 contracts DTO。
- mock：与真实实现分文件，供无数据库测试和本地开发使用。
- types：保存稳定服务合同，避免 route 和其他模块依赖具体实现细节。

好友域采用 `friendService.ts + friend.policy.ts + friend.mapper.ts + friend.mock.ts + friend.types.ts`；报告域使用 service/repository/mapper/mock；账号数据生命周期独立为 `accountDataService.ts`。

## 共享契约与 OpenAPI

`packages/contracts` 按 common、auth、users、dataSync、friends、growth、push、reports、subscriptions 拆分。Zod schema 是运行时校验与 TypeScript 类型的共同来源。

Hono OpenAPI 注册表直接读取 route 和共享 schema 生成 `api-reference.md` 与 `openapi.json`。新增或修改接口时只修改 route 和 contracts，然后更新快照与生成物，不维护第二份 operations 清单。

## 事务与数据边界

数据库与事务共同保证 refresh session 轮换、好友容量、邀请单次消费、每日提醒计数、回执修改窗口、同步 mutation 幂等和报告 upsert。

通用 HTTP 边界统一提供：

- request id 与结构化日志；
- 安全响应头；
- 256 KiB 默认请求体限制；
- 可配置的单进程固定窗口限流；
- 结构化 4xx/5xx 错误，不回传内部异常。

多实例全局限流属于部署层职责，需由网关或共享存储实现。

## 构建与验证

`packages/contracts` 先编译为 ESM，API 再由 TypeScript 编译到 `apps/api/dist`。生产入口执行 `node dist/server.js`，不依赖运行时 `tsx`。

真实 PostgreSQL 集成测试负责验证事务、索引和 Drizzle 行为；Mock 测试不能替代这些门禁。当前集成覆盖认证、用户/权益、报告、好友/同步、账号删除与保留策略。
