# 小提督 v0.2 后端详细开发方案

版本：v0.2
日期：2026-05-22
阶段：后端开发规划
关联文档：[v0.2 PRD](./prd.md)、[v0.2 开发方案](./development-plan.md)、[整体开发路线图](../development-roadmap.md)、[项目结构说明](../project-structure.md)

## 1. 后端目标

v0.2 后端只服务 Pro 能力，不接管 v0.1 的本地单人闭环。

后端负责：

- 账号登录。
- 会员权益。
- 小队和监督搭子关系。
- 低敏共享快照。
- 搭子提醒和提醒回执。
- Push token 与推送任务。
- 高级小报告所需摘要。
- Apple Watch 跨设备能力所需的账号与摘要同步。

后端不负责：

- 诊断、治疗、问诊。
- 存储完整本地 SQLite 数据。
- 默认存储明显便血、明显不舒服、具体蹲会儿时长、排便感受等敏感细节。
- 聊天、自由文本、评论区、排行榜。

## 2. 技术选型

当前仓库已有：

- `apps/api`：后端服务骨架。
- `packages/contracts`：前后端共享类型。

推荐 v0.2 技术栈：

| 类别 | 选择 | 原因 |
| --- | --- | --- |
| Runtime | Node.js 24 LTS 当前本机版本 | 与当前本地环境一致 |
| Web 框架 | Hono | 轻量、类型友好、适合 API 服务 |
| 数据库 | Postgres | 关系模型适合账号、订阅、小队和提醒 |
| ORM / Query Builder | Drizzle | 类型明确、迁移轻量、比大型 ORM 更贴合当前阶段 |
| 校验 | Zod | API 入参、环境变量和 contracts 可共用思路 |
| 鉴权 | Sign in with Apple + 服务端 session/JWT | iOS 首期优先 |
| 订阅 | StoreKit 2 + App Store Server API | iOS 会员权益必需 |
| 推送 | Expo Push 起步，后续必要时切 APNs | 当前移动端已有 Expo 生态 |
| 日志 | pino | 轻量结构化日志 |
| 测试 | vitest | 单测和 API handler 测试够用 |

不建议 v0.2 初期引入：

- GraphQL。
- 微服务。
- 消息队列。
- Redis 强依赖。
- 自由聊天系统。
- 完整数据仓库。

## 3. 目录规划

目标目录：

```text
apps/api/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── src/
│   ├── server.ts              # Node 入口，负责 listen
│   ├── app.ts                 # Hono app 组合
│   ├── config/
│   │   └── env.ts             # 环境变量校验
│   ├── db/
│   │   ├── client.ts          # Postgres client
│   │   ├── schema.ts          # Drizzle schema
│   │   └── migrations/        # SQL migrations
│   ├── http/
│   │   ├── errors.ts          # 统一错误类型
│   │   ├── response.ts        # 成功/失败响应
│   │   └── middleware.ts      # auth、request id、日志
│   ├── modules/
│   │   ├── auth/
│   │   ├── entitlements/
│   │   ├── teams/
│   │   ├── sharing/
│   │   ├── nudges/
│   │   ├── push/
│   │   ├── reports/
│   │   └── subscriptions/
│   └── tests/
└── .env.example
```

模块边界：

| 模块 | 责任 |
| --- | --- |
| `auth` | Apple 登录、用户身份、session/JWT |
| `entitlements` | 统一会员权益判断 |
| `subscriptions` | App Store 订阅校验和通知 |
| `teams` | 小队、成员、邀请、退出、移除 |
| `sharing` | 共享设置、每日低敏快照 |
| `nudges` | 搭子提醒、每日上限、回执 |
| `push` | Push token、发送通知 |
| `reports` | 90 天报告、小队周报摘要 |

## 4. 数据边界

### 4.1 本地保留

继续只在移动端 SQLite 保存：

- 原始菊花抬训练记录。
- 原始蹲会儿记录。
- 具体蹲会儿时长。
- 明显便血。
- 明显不舒服。
- 排便感受。
- 小账本每日明细。

### 4.2 云端可保存

云端只保存 Pro 功能必要数据：

- 用户账号。
- 订阅状态。
- 小队关系。
- 邀请。
- 共享设置。
- 低敏每日快照。
- 搭子提醒。
- 提醒回执。
- Push token。
- 高级报告摘要。

### 4.3 低敏每日快照

每日共享快照只允许包含：

```ts
type DailyShareSnapshot = {
  date: string;
  trainingDone: boolean;
  habitCompletion: 0 | 1 | 2 | 3 | 4;
  toiletRecorded: boolean;
  streakDays: number;
};
```

不得加入：

- `toiletDurationSeconds`
- `bleeding`
- `discomfort`
- `bowelFeeling`
- 任何备注文本

如果未来确实要扩展共享内容，必须新增独立授权项，不能默认开启。

## 5. 数据库设计

Postgres 表建议使用 `uuid` 主键、`timestamptz` 时间、必要字段加唯一约束。查询高频字段要有索引，软删除字段不应破坏唯一约束。

### 5.1 users

用户账号表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| apple_user_id | text | Apple sub，唯一 |
| nickname | text | 昵称 |
| avatar_url | text | 头像，v0.2 可为空 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |
| deleted_at | timestamptz | 注销时间 |

索引：

- `unique (apple_user_id)` where `deleted_at is null`

### 5.2 subscriptions

订阅状态表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户 |
| product_id | text | 商品 ID |
| original_transaction_id | text | Apple 原始交易 ID |
| status | text | active / grace_period / expired / revoked |
| expires_at | timestamptz | 到期时间 |
| last_verified_at | timestamptz | 最近校验 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

索引：

- `index (user_id, status)`
- `unique (original_transaction_id)`

### 5.3 teams

小队表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| owner_user_id | uuid | 创建者 |
| name | text | 小队名 |
| created_at | timestamptz | 创建时间 |
| archived_at | timestamptz | 归档时间 |

约束：

- v0.2 每个 Pro 用户最多 1 个 active 小队。

### 5.4 team_members

小队成员表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| team_id | uuid | 小队 |
| user_id | uuid | 用户 |
| role | text | owner / buddy |
| status | text | active / paused / removed |
| display_name | text | 小队内昵称 |
| joined_at | timestamptz | 加入时间 |
| removed_at | timestamptz | 移除时间 |

索引：

- `index (team_id, status)`
- `index (user_id, status)`
- `unique (team_id, user_id)` where `removed_at is null`

### 5.5 team_invites

邀请表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| team_id | uuid | 小队 |
| inviter_user_id | uuid | 邀请者 |
| token_hash | text | 邀请 token hash |
| expires_at | timestamptz | 默认 7 天 |
| accepted_by_user_id | uuid | 接受者 |
| accepted_at | timestamptz | 接受时间 |
| revoked_at | timestamptz | 撤销时间 |
| created_at | timestamptz | 创建时间 |

安全规则：

- 原始 token 只返回给创建请求一次。
- 数据库只存 hash。
- 过期或撤销后不可接受。

### 5.6 share_settings

共享设置表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| team_id | uuid | 小队 |
| user_id | uuid | 用户 |
| share_training | boolean | 分享菊花抬是否完成 |
| share_habit_completion | boolean | 分享小账本完成度 |
| share_toilet_recorded | boolean | 分享蹲会儿是否记过 |
| share_streak | boolean | 分享连续天数 |
| paused | boolean | 暂停共享 |
| updated_at | timestamptz | 更新时间 |

默认：

- 低敏项默认开启。
- `paused = false`。
- 不存在敏感共享开关，因为 v0.2 不做敏感共享。

### 5.7 daily_share_snapshots

每日低敏快照。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户 |
| date | date | 日期 |
| training_done | boolean | 今日菊花抬是否完成 |
| habit_completion | smallint | 0-4 |
| toilet_recorded | boolean | 今日是否记过蹲会儿 |
| streak_days | integer | 连续完成天数 |
| weekly_training_days | smallint | 近 7 天菊花抬营业天数 |
| weekly_habit_full_days | smallint | 近 7 天小账本满格天数 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

约束：

- `unique (user_id, date)`
- `habit_completion between 0 and 4`

索引：

- `index (user_id, date desc)`

### 5.8 buddy_nudges

搭子提醒表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| team_id | uuid | 小队 |
| from_user_id | uuid | 发起者 |
| to_user_id | uuid | 接收者 |
| type | text | gentle / move / not_blank / habit_left / posture |
| created_at | timestamptz | 创建时间 |
| expires_at | timestamptz | 过期时间 |

规则：

- 只能发给同一 active 小队成员。
- 每个搭子每日次数受设置限制，默认 5 次。
- 不支持自由文本。

索引：

- `index (to_user_id, created_at desc)`
- `index (from_user_id, to_user_id, created_at desc)`

### 5.9 buddy_nudge_acks

提醒回执表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| nudge_id | uuid | 提醒 |
| user_id | uuid | 回执者 |
| status | text | received / later / done |
| revision_count | smallint | 修改次数 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

约束：

- `unique (nudge_id, user_id)`
- `revision_count <= 1`

业务规则：

- 每条提醒只能回执一次。
- 30 分钟内允许修改一次。
- 回执只展示给发起提醒的搭子。

### 5.10 buddy_nudge_limits

单个搭子的提醒上限设置。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 被提醒者 |
| buddy_user_id | uuid | 搭子 |
| daily_limit | smallint | 0 / 3 / 5 / 8 |
| updated_at | timestamptz | 更新时间 |

默认：

- 无记录时按 5 次处理。
- `0` 表示关闭该搭子的主动提醒。

约束：

- `unique (user_id, buddy_user_id)`
- `daily_limit in (0, 3, 5, 8)`

### 5.11 push_tokens

推送 token 表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户 |
| platform | text | ios / android |
| provider | text | expo / apns |
| token | text | token |
| enabled | boolean | 是否启用 |
| updated_at | timestamptz | 更新时间 |

索引：

- `index (user_id, enabled)`
- `unique (provider, token)`

### 5.12 audit_events

审计事件表，只记录安全与关系操作，不记录健康细节。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 操作人 |
| event_type | text | 事件类型 |
| target_type | text | 目标类型 |
| target_id | uuid | 目标 ID |
| created_at | timestamptz | 创建时间 |

记录场景：

- 登录。
- 创建小队。
- 接受邀请。
- 移除成员。
- 暂停共享。
- 订阅状态变化。

## 6. API 设计

### 6.1 统一响应

成功：

```json
{
  "data": {}
}
```

失败：

```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found"
  }
}
```

建议错误码：

| code | HTTP | 说明 |
| --- | --- | --- |
| `bad_request` | 400 | 入参错误 |
| `unauthorized` | 401 | 未登录 |
| `forbidden` | 403 | 无权限或非 Pro |
| `not_found` | 404 | 资源不存在 |
| `rate_limited` | 429 | 搭子提醒超限 |
| `conflict` | 409 | 状态冲突 |
| `internal_error` | 500 | 未预期错误 |

### 6.2 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 服务健康检查 |

响应：

```ts
type ApiHealthResponse = {
  ok: true;
  service: 'xiaotidu-api';
  version: string;
};
```

### 6.3 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/apple` | Apple 登录 |
| POST | `/auth/logout` | 退出登录 |
| GET | `/me` | 当前用户 |

`POST /auth/apple` 请求：

```ts
type AppleLoginRequest = {
  identityToken: string;
  authorizationCode?: string;
  nickname?: string;
};
```

响应：

```ts
type AuthResponse = {
  token: string;
  user: {
    id: string;
    nickname: string;
  };
};
```

MVP 策略：

- 移动端使用 Bearer token。
- 服务端验证 Apple identity token。
- token 到期后让用户重新登录，v0.2 初期不做复杂 refresh token。

### 6.4 会员权益

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/me/entitlements` | 查询权益 |
| POST | `/subscriptions/verify` | 客户端提交订阅交易校验 |
| POST | `/subscriptions/restore` | 恢复购买 |
| POST | `/app-store/notifications` | App Store Server Notifications |

权益响应：

```ts
type EntitlementsResponse = {
  proStatus: 'free' | 'pro_active' | 'pro_grace_period' | 'pro_expired';
};
```

取消订阅策略：

- 基础功能继续可用。
- Pro 功能冻结。
- 小队关系和历史数据保留。
- 共享快照不再更新。
- 重新订阅后恢复。

### 6.5 小队

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/teams` | 创建小队 |
| GET | `/teams/current` | 查询当前小队 |
| PATCH | `/teams/current` | 更新小队名 |
| POST | `/teams/current/leave` | 退出小队 |
| DELETE | `/teams/current/members/:memberId` | 移除成员 |

规则：

- 创建小队需要 Pro。
- v0.2 每个用户最多 1 个 active 小队。
- 每个小队最多 3 个搭子，不含 owner 最多 3 人。
- 非小队成员不能访问小队数据。

### 6.6 邀请

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/teams/current/invites` | 生成邀请 |
| GET | `/team-invites/:token` | 查看邀请 |
| POST | `/team-invites/:token/accept` | 接受邀请 |
| POST | `/teams/current/invites/:inviteId/revoke` | 撤销邀请 |

规则：

- 邀请默认 7 天有效。
- 过期、撤销、已接受的邀请不可再次使用。
- 邀请 token 原文只返回一次。
- 数据库存 token hash。

### 6.7 共享设置与快照

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/share-settings` | 查询共享设置 |
| PUT | `/share-settings` | 更新共享设置 |
| PUT | `/share-snapshots/today` | 上传今日低敏快照 |
| GET | `/teams/current/snapshots` | 查询小队成员快照 |

`PUT /share-snapshots/today` 请求：

```ts
type UpsertDailyShareSnapshotRequest = {
  snapshot: DailyShareSnapshot;
};
```

规则：

- 未登录不上传。
- 非 Pro 或订阅过期时可停止上传。
- 暂停共享时停止给搭子展示新快照。
- 不接受敏感字段。

### 6.8 搭子提醒

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/nudges` | 发送搭子提醒 |
| GET | `/nudges/inbox` | 收到的提醒 |
| GET | `/nudges/sent` | 发出的提醒 |
| POST | `/nudges/:id/ack` | 提交或修改回执 |
| GET | `/buddy-nudge-limits` | 查询搭子提醒上限 |
| PUT | `/buddy-nudge-limits/:buddyUserId` | 设置单个搭子提醒上限 |

`POST /nudges` 请求：

```ts
type CreateBuddyNudgeRequest = {
  toUserId: string;
  type: 'gentle' | 'move' | 'not_blank' | 'habit_left' | 'posture';
};
```

规则：

- 只允许预设提醒类型。
- 不允许自由文本。
- 每个搭子每日上限默认 5 次。
- 上限可选 0、3、5、8。
- `0` 表示关闭该搭子的主动提醒。
- 服务端必须按 `from_user_id + to_user_id + 当日` 计数。

`POST /nudges/:id/ack` 请求：

```ts
type AckBuddyNudgeRequest = {
  status: 'received' | 'later' | 'done';
};
```

规则：

- 只有接收者能回执。
- 每条提醒最多一条回执。
- 30 分钟内允许修改一次。
- 回执不进入公开动态。

### 6.9 Push token

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/push-tokens` | 注册 token |
| DELETE | `/push-tokens/:id` | 禁用 token |

推送场景：

- 搭子提醒。
- 提醒回执。
- 小队邀请接受。

推送不应包含：

- 具体蹲会儿时长。
- 便血、不适等风险词。
- 健康细节。

### 6.10 高级小报告

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/reports/advanced?range=90d` | 90 天高级小报告 |
| GET | `/teams/current/reports/weekly` | 小队周报 |

规则：

- 需要 Pro。
- 只基于低敏摘要生成。
- 不生成健康评分。
- 不做排行榜。
- 不把风险数据用于庆祝文案。

## 7. 权限与鉴权

### 7.1 鉴权层

所有非公开接口都需要 Bearer token。

公开接口：

- `GET /health`
- `GET /team-invites/:token`
- `POST /auth/apple`
- `POST /app-store/notifications`

其他接口都必须有 `currentUser`。

### 7.2 权益层

需要 Pro 的操作：

- 创建小队。
- 创建邀请。
- 发送搭子提醒。
- 查看高级小报告。
- 使用小队周报。

不需要 Pro 的操作：

- 接受邀请。
- 查看自己已加入的小队基础信息。
- 修改自己的共享设置。
- 退出小队。
- 提交提醒回执。

### 7.3 小队权限

服务端必须校验：

- 用户是否属于该小队。
- 成员状态是否 active。
- 是否是 owner。
- 是否访问自己的或同队成员的低敏数据。

不能只依赖客户端隐藏按钮。

## 8. 订阅与取消处理

订阅状态来源：

1. 客户端购买后主动提交交易。
2. App Store Server Notifications 异步更新。
3. 用户点击恢复购买时主动刷新。

状态解释：

| 状态 | 行为 |
| --- | --- |
| `free` | 只能使用基础功能 |
| `pro_active` | Pro 功能可用 |
| `pro_grace_period` | Pro 功能暂时可用，但提示付款异常 |
| `pro_expired` | Pro 功能冻结，基础功能可用 |

取消订阅后：

- 不删除小队。
- 不删除历史提醒和回执。
- 不删除历史高级报告摘要。
- 停止新增 Pro 行为。
- 停止更新共享快照。
- 搭子看到“对方已暂停小队功能”之类的低压状态。

用户注销或删除数据时：

- 删除或匿名化用户资料。
- 停止所有 push token。
- 小队关系置为 removed。
- 保留必要订阅审计记录，具体保留策略后续按上架合规要求确定。

## 9. 推送策略

v0.2 MVP 可以先用 Expo Push。

推送类型：

| 类型 | 触发 | 接收者 |
| --- | --- | --- |
| `buddy_nudge` | 搭子轻轻戳一下 | 被提醒者 |
| `buddy_nudge_ack` | 对方回执 | 提醒发起者 |
| `team_invite_accepted` | 邀请被接受 | 邀请者 |

推送内容原则：

- 使用轻松低敏文案。
- 不包含风险词。
- 不包含具体健康数据。
- 不包含自由文本。

示例：

```text
小队里有人轻轻戳了你一下
起来活动一下
```

通知动作：

- 收到。
- 等会儿。
- 已完成。

移动端点击通知动作后调用 `/nudges/:id/ack`。

## 10. 高级报告生成策略

v0.2 不需要复杂异步任务系统。可以先按请求实时聚合或每日懒更新。

建议策略：

- 90 天报告：按 `daily_share_snapshots` 聚合。
- 小队周报：按小队成员近 7 天快照聚合。
- 结果不长期缓存，或只缓存短期摘要。

可展示指标：

- 菊花抬营业天数。
- 小账本满格天数。
- 蹲会儿记过天数。
- 蹲会儿长会趋势只用本地或用户显式授权摘要，v0.2 不从云端推断敏感细节。

注意：如果云端不保存具体蹲会儿时长，则云端高级报告不能准确计算“长会次数”。v0.2 有两种选择：

1. 不在云端小队报告展示长会次数，只在本机高级报告展示。
2. 上传低敏布尔摘要 `toiletLongSessionObserved`，但必须在共享设置中单独说明。

推荐 v0.2 采用方案 1，避免扩大云端健康数据范围。

## 11. 环境变量

`.env.example` 建议包含：

```text
NODE_ENV=development
PORT=8787
DATABASE_URL=postgres://postgres:postgres@localhost:5432/xiaotidu
JWT_SECRET=replace-me
APPLE_BUNDLE_ID=com.kex.xiaotidu
APPLE_ISSUER_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
EXPO_PUSH_ACCESS_TOKEN=
```

规则：

- `.env` 不提交。
- `.env.example` 提交。
- 环境变量必须经过 `config/env.ts` 校验。

## 12. 本地开发流程

### 12.1 启动后端

```bash
pnpm api:dev
```

默认端口：

```text
http://localhost:8787
```

健康检查：

```bash
curl http://localhost:8787/health
```

### 12.2 启动移动端

```bash
pnpm mobile:start
```

或 iOS：

```bash
pnpm mobile:ios
```

### 12.3 后端接入移动端

移动端建议新增 API client：

```text
apps/mobile/src/features/api/
  apiClient.ts
  authClient.ts
  entitlementsClient.ts
  teamsClient.ts
```

API base URL：

- 开发：`http://localhost:8787`
- 真机局域网：使用 Mac 局域网 IP
- 远程测试：后续使用部署环境

基础功能不能依赖 API 成功；API 失败时只影响 Pro 功能。

## 13. 测试策略

### 13.1 单元测试

优先覆盖：

- 权益判断。
- 小队权限判断。
- 搭子提醒次数限制。
- 回执 30 分钟修改规则。
- 快照字段过滤。
- 邀请过期和撤销。

### 13.2 API 测试

覆盖：

- 未登录访问返回 401。
- 非 Pro 创建小队返回 403。
- 超过搭子提醒上限返回 429。
- 非小队成员不能访问快照。
- 敏感字段上传被拒绝。

### 13.3 隐私测试

必须验证：

- `daily_share_snapshots` 不包含敏感字段。
- 小队接口不返回具体蹲会儿时长。
- 回执只返回给发起提醒的搭子。
- 移除成员后不能访问新数据。

## 14. 实施步骤

### B1. API 基础设施

1. 引入 Hono、Zod、pino。
2. 拆分 `server.ts` 和 `app.ts`。
3. 实现统一成功/错误响应。
4. 实现 request id 和日志。
5. 保留 `/health` 和 `/me/entitlements`。

验收：

- `pnpm api:dev` 可运行。
- `GET /health` 可用。
- 类型检查通过。

### B2. Contracts 扩展

1. 补充通用响应类型。
2. 补充 auth DTO。
3. 补充 team DTO。
4. 补充 share settings DTO。
5. 补充 nudge DTO。
6. 补充 report DTO。

验收：

- `@xiaotidu/api` 和 `@xiaotidu/mobile` 都从 contracts 引用共享类型。
- contracts 不引用移动端或后端私有代码。

### B3. 数据库接入

1. 引入 Drizzle 和 Postgres client。
2. 定义 schema。
3. 生成 migration。
4. 加入 seed。
5. 加入本地数据库说明。

验收：

- migration 可跑。
- seed 可跑。
- 数据库表和索引符合本方案。

### B4. 认证与权益

1. 实现 Apple 登录。
2. 实现 token 签发。
3. 实现 auth middleware。
4. 实现 `/me`。
5. 实现 `/me/entitlements`。
6. 增加订阅状态占位。

验收：

- 未登录接口返回 401。
- 登录后可查询当前用户。
- 权益状态可查询。

### B5. 小队与共享快照

1. 实现小队 CRUD。
2. 实现邀请。
3. 实现共享设置。
4. 实现每日快照 upsert。
5. 实现小队快照查询。

验收：

- 小队链路可跑通。
- 快照不含敏感字段。
- 非成员不能访问。

### B6. 搭子提醒与回执

1. 实现提醒创建。
2. 实现每日上限。
3. 实现回执创建和 30 分钟修改规则。
4. 接入 push token。
5. 发送 Expo Push。

验收：

- 提醒次数限制正确。
- 回执权限正确。
- 推送不含敏感数据。

### B7. 高级小报告

1. 实现 90 天个人报告。
2. 实现小队周报。
3. Pro 权益校验。
4. 不足数据的空状态。

验收：

- 免费用户被 paywall 拦截。
- Pro 用户可查询。
- 报告只基于低敏摘要。

## 15. 当前下一步

建议下一步直接实现 **B1 API 基础设施**：

1. 安装 `hono`、`zod`、`pino`、`vitest`。
2. 拆分 `apps/api/src/server.ts`。
3. 新增 `apps/api/src/app.ts`。
4. 新增统一响应和错误结构。
5. 增加后端 smoke 测试。

完成 B1 后再接数据库，避免一开始把框架、数据库、鉴权和订阅全部混在一起。
