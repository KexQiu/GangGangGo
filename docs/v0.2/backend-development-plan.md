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
| latest_transaction_id | text | Apple 最新交易 ID |
| environment | text | sandbox / production |
| app_account_token | uuid | Apple appAccountToken |
| status | text | active / grace_period / expired / revoked |
| expires_at | timestamptz | 到期时间 |
| revoked_at | timestamptz | 撤销或退款时间 |
| auto_renew_status | text | on / off / unknown |
| last_notification_type | text | 最近 App Store 通知类型 |
| last_verified_at | timestamptz | 最近校验 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

索引：

- `index (user_id, status)`
- `unique (original_transaction_id)`

### 5.3 subscription_events

订阅事件流水表，用于记录 App Store Server Notifications 和订阅校验事件。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户，可为空 |
| original_transaction_id | text | Apple 原始交易 ID |
| transaction_id | text | Apple 交易 ID |
| environment | text | sandbox / production |
| event_type | text | 事件类型 |
| payload | jsonb | Apple 原始事件 payload |
| received_at | timestamptz | 接收时间 |
| processed_at | timestamptz | 处理时间 |
| processing_error | text | 处理错误 |

索引：

- `index (original_transaction_id)`
- `index (received_at)`

### 5.4 teams

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

### 5.5 team_members

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
| paused_at | timestamptz | 暂停共享时间 |
| removed_at | timestamptz | 移除时间 |

索引：

- `index (team_id, status)`
- `index (user_id, status)`
- `unique (team_id, user_id)` where `removed_at is null`

### 5.6 team_invites

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

### 5.7 share_settings

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
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

默认：

- 低敏项默认开启。
- `paused = false`。
- 不存在敏感共享开关，因为 v0.2 不做敏感共享。

### 5.8 daily_share_snapshots

搭子可见的每日低敏快照。这个表只服务好友监督，不存蹲会儿长会、便血、不适、具体时长等可能尴尬或敏感的信息。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户 |
| date | date | 日期 |
| training_done | boolean | 今日菊花抬是否完成 |
| habit_completion | smallint | 0-4 |
| toilet_recorded | boolean | 今日是否记过蹲会儿 |
| streak_days | integer | 连续完成天数 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

约束：

- `unique (user_id, date)`
- `habit_completion between 0 and 4`

索引：

- `index (user_id, date desc)`

### 5.9 daily_report_snapshots

用户自己的高级小报告摘要。它可以存更多聚合字段，但仍不存便血、不适、排便感受和具体蹲会儿时长。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户 |
| date | date | 日期 |
| training_done | boolean | 今日菊花抬是否完成 |
| habit_completion | smallint | 0-4 |
| habit_full | boolean | 小账本是否满格 |
| toilet_recorded | boolean | 今日是否记过蹲会儿 |
| toilet_long_meeting | boolean | 今日是否出现蹲会儿长会，仅用户自己报告可用 |
| streak_days | integer | 连续完成天数 |
| weekly_training_days | smallint | 近 7 天菊花抬营业天数 |
| weekly_habit_full_days | smallint | 近 7 天小账本满格天数 |
| weekly_toilet_long_meeting_count | smallint | 近 7 天蹲会儿长会次数 |
| thirty_day_training_days | smallint | 近 30 天菊花抬营业天数 |
| thirty_day_habit_full_days | smallint | 近 30 天小账本满格天数 |
| thirty_day_toilet_long_meeting_count | smallint | 近 30 天蹲会儿长会次数 |
| ninety_day_training_days | smallint | 近 90 天菊花抬营业天数 |
| ninety_day_habit_full_days | smallint | 近 90 天小账本满格天数 |
| ninety_day_toilet_long_meeting_count | smallint | 近 90 天蹲会儿长会次数 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

约束：

- `unique (user_id, date)`
- `habit_completion between 0 and 4`
- 7/30/90 天计数字段必须在对应范围内或非负。

### 5.10 buddy_nudges

搭子提醒表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| team_id | uuid | 小队 |
| from_user_id | uuid | 发起者 |
| to_user_id | uuid | 接收者 |
| type | text | gentle / move / not_blank / habit_left / posture |
| message_template | text | 固定模板文案 |
| created_at | timestamptz | 创建时间 |
| expires_at | timestamptz | 过期时间 |

规则：

- 只能发给同一 active 小队成员。
- 每个搭子每日次数受设置限制，默认 5 次。
- 不支持自由文本。

索引：

- `index (to_user_id, created_at desc)`
- `index (from_user_id, to_user_id, created_at desc)`

### 5.11 buddy_nudge_acks

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

### 5.12 buddy_nudge_settings

单个搭子的提醒权限、每日上限和多段勿扰设置。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| team_id | uuid | 小队 |
| user_id | uuid | 被提醒者 |
| buddy_user_id | uuid | 搭子 |
| daily_limit | smallint | 0 / 3 / 5 / 8 |
| enabled | boolean | 是否允许这个搭子提醒 |
| quiet_ranges | jsonb | 多段勿扰时间 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

默认：

- 无记录时按 5 次处理。
- `0` 表示关闭该搭子的主动提醒。
- `enabled = false` 表示关闭该搭子的主动提醒，但不移除小队关系。

约束：

- `unique (team_id, user_id, buddy_user_id)`
- `daily_limit in (0, 3, 5, 8)`

### 5.13 push_tokens

推送 token 表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 用户 |
| platform | text | ios / android |
| provider | text | expo / apns |
| token | text | token |
| device_id | text | 设备标识 |
| enabled | boolean | 是否启用 |
| last_seen_at | timestamptz | 最近活跃时间 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

索引：

- `index (user_id, enabled)`
- `unique (provider, token)`

### 5.14 audit_events

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
    timezone: string;
  };
};
```

MVP 策略：

- 移动端使用 Bearer token。
- 开发和测试环境默认使用 mock Apple 校验服务，方便本地无 Apple 依赖测试。
- 生产环境默认使用真实 Apple JWT 校验，校验 issuer、audience 和 subject。
- B4 使用服务端 HS256 access token；`JWT_SECRET` 生产环境必填，不能使用开发默认值。
- API 启动时如果配置了 `DATABASE_URL`，用户仓储使用 Drizzle 写入 `users` 表；未配置时自动使用 mock 用户仓储，方便无数据库测试。
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

权益计算规则：

- 无订阅记录：`free`。
- `active` 且未过期：`pro_active`。
- `grace_period` 且未过期：`pro_grace_period`。
- `expired`、`revoked` 或到期时间已过：`pro_expired`。
- 有 `DATABASE_URL` 时从 `subscriptions` 表计算；无数据库配置时返回 mock `free`，方便本地开发。
- `POST /subscriptions/verify` 和 `POST /subscriptions/restore` 已提供占位接口，当前返回 `pending_verification` 和现有权益。
- 真实 StoreKit 2 / App Store Server API 交易校验、订阅事件写入和 `/app-store/notifications` 尚未实现。

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
| PATCH | `/teams/current/members/me/status` | 暂停或恢复自己的共享状态 |

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
| GET | `/buddy-nudge-settings` | 查询搭子提醒设置 |
| PUT | `/buddy-nudge-settings/:buddyUserId` | 设置单个搭子的提醒权限、次数和勿扰 |

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
- 小队邀请接受，后续接入。

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

- 90 天个人报告：按 `daily_report_snapshots` 聚合，只给用户自己看。
- 小队周报：按小队成员近 7 天 `daily_share_snapshots` 聚合，只展示低敏状态。
- 结果不长期缓存，或只缓存短期摘要。

可展示指标：

- 菊花抬营业天数。
- 小账本满格天数。
- 蹲会儿记过天数。
- 蹲会儿长会趋势只用本地或用户显式授权摘要，v0.2 不从云端推断敏感细节。

注意：`daily_report_snapshots` 中的蹲会儿长会聚合只用于用户自己的高级小报告，不进入小队共享接口。

## 11. 环境变量

`.env.example` 建议包含：

```text
NODE_ENV=development
PORT=8787
LOG_LEVEL=info
DATABASE_URL=postgres://postgres:postgres@localhost:5432/xiaotidu
DB_SSL=false
JWT_SECRET=replace-me
APPLE_AUTH_MODE=mock
APPLE_BUNDLE_ID=com.kex.xiaotidu
APPLE_JWKS_URL=https://appleid.apple.com/auth/keys
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
curl http://localhost:8787/health/db
```

数据库迁移：

```bash
pnpm --filter @xiaotidu/api db:generate
pnpm --filter @xiaotidu/api db:migrate
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
- `daily_report_snapshots` 不向搭子接口返回。
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

### B2. 数据库与迁移

1. 引入 `drizzle-orm`、`postgres`、`drizzle-kit`。
2. 补充 `DATABASE_URL` 和 `DB_SSL` 环境变量。
3. 定义 Drizzle schema。
4. 拆分 `daily_share_snapshots` 和 `daily_report_snapshots`。
5. 用 `buddy_nudge_settings` 承接次数、开关和多段勿扰。
6. 生成首个 SQL migration。
7. 增加 `GET /health/db`。

验收：

- `pnpm --filter @xiaotidu/api db:generate` 可生成迁移。
- 无 `DATABASE_URL` 时 `/health/db` 返回 `database_not_configured`。
- 数据库不可达时 `/health/db` 返回 `database_unreachable`。
- schema 类型检查通过。

### B3. Contracts 扩展

1. 补充通用响应类型。
2. 补充 auth DTO。
3. 补充 team DTO。
4. 补充 share settings DTO。
5. 补充 nudge DTO。
6. 补充 report DTO。
7. 补充 constants，确保移动端和后端共用提醒类型、回执状态和每日次数选项。

验收：

- `@xiaotidu/api` 和 `@xiaotidu/mobile` 都从 contracts 引用共享类型。
- contracts 不引用移动端或后端私有代码。

### B4. 认证与权益

1. 实现 `POST /auth/apple` 登录链路。
2. 实现 HS256 token 签发和验证。
3. 实现 auth middleware。
4. 实现 `/me`。
5. 实现 `/me/entitlements`。
6. 实现 Drizzle 用户仓储；有 `DATABASE_URL` 时登录会 upsert `users` 表。
7. 实现真实 Apple identity token 校验服务；生产环境默认启用。
8. 实现 Drizzle 权益服务；有 `DATABASE_URL` 时从 `subscriptions` 表计算权益。
9. App Store 交易校验和订阅事件处理暂不实现，留到订阅模块。

验收：

- 未登录接口返回 401。
- 登录后可查询当前用户。
- 权益状态可查询。
- active / grace_period / expired / revoked 的权益映射有单元测试覆盖。
- `/auth/apple`、`/me`、`/me/entitlements` 有 API 测试覆盖。
- 生产环境如果缺少 `APPLE_BUNDLE_ID` 或使用 mock Apple 校验，应启动失败。

### B5. 小队与共享快照

当前已完成第一阶段最小链路：

1. 实现 `POST /teams` 创建小队。
2. 实现 `GET /teams/current` 查询当前小队。
3. 实现 `PATCH /teams/current` 更新小队名。
4. 实现 `POST /teams/current/leave` 退出小队；owner 退出时归档小队。
5. 实现 `DELETE /teams/current/members/:memberId` 移除成员。
6. 实现 `PATCH /teams/current/members/me/status` 暂停或恢复自己的共享状态。
7. 实现 `PUT /share-settings` 更新共享设置。
8. 实现 `PUT /share-snapshots/today` 上传今日低敏快照。
9. 实现 `GET /teams/current/snapshots` 查询小队快照。
10. 实现 `POST /teams/current/invites` 创建邀请。
11. 实现 `GET /team-invites/:token` 公开预览邀请。
12. 实现 `POST /team-invites/:token/accept` 登录后接受邀请。
13. 有 `DATABASE_URL` 时使用 Drizzle 写入真实表；无数据库时使用 mock service，方便本地开发。
14. `POST /teams` 和 `POST /teams/current/invites` 已接入 Pro 权益拦截。
15. 接受邀请不需要 Pro，符合“被邀请者可免费加入监督”的产品规则。
16. Drizzle 接受邀请时使用条件更新消费 token，避免同一个邀请被并发重复接受。

暂未实现：

- 邀请撤销。
- 多个不同邀请同时接受导致小队满员竞争时的数据库级强约束。

验收：

- 小队链路可跑通。
- 快照不含敏感字段；接口只返回 `trainingDone`、`habitCompletion`、`toiletRecorded`、`streakDays` 中用户允许共享的字段。
- 非成员不能访问。
- 未登录访问小队和共享接口返回 401。
- 未创建小队时上传快照或查询快照返回 404。
- 邀请 token 原文只返回一次，数据库只存 token hash。
- 过期、已接受或撤销的邀请不可再次接受。
- 每个小队最多 1 个 owner + 3 个搭子。
- 成员暂停共享后，小队快照仍显示成员，但 `snapshot = null`。
- 成员被移除或退出后，不能继续访问该小队。

### B6. 搭子提醒与回执

当前已完成第一阶段最小链路：

1. 实现 `POST /nudges` 创建搭子提醒。
2. 实现 `GET /nudges/inbox` 查询收到的提醒。
3. 实现 `GET /nudges/sent` 查询发出的提醒。
4. 实现 `POST /nudges/:id/ack` 创建或修改回执。
5. 实现 `GET /buddy-nudge-settings` 查询单个搭子的提醒权限、每日上限和勿扰范围。
6. 实现 `PUT /buddy-nudge-settings/:buddyUserId` 更新单个搭子的提醒权限、每日上限和勿扰范围。
7. 实现 `POST /push-tokens` 注册 Expo/APNs push token。
8. 搭子提醒只支持预设类型，不支持自由文本。
9. 每个搭子的每日提醒上限按 `buddy_nudge_settings` 执行，默认 5 次，支持 0 / 3 / 5 / 8。
10. 回执支持 `received / later / done`，30 分钟内允许修改一次。
11. 创建搭子提醒后触发 Expo Push 发送给被提醒者。
12. 创建或修改回执后触发 Expo Push 发送给提醒发起者。
13. 推送发送失败不影响提醒/回执主流程。
14. `quiet_ranges` 已生效；当前时间命中搭子免打扰范围时，创建提醒会返回 `403 forbidden`。
15. Expo Push 返回 `DeviceNotRegistered` 时，会自动禁用对应 push token。

暂未实现：

- App 内接收推送后的通知 action 处理。
- Expo Push receipt 查询和重试队列。
- 小队邀请接受后的推送。

验收：

- 提醒次数限制正确。
- 回执权限正确。
- 推送 token 可以注册或更新。
- 有可用 Expo Push token 时，提醒和回执会发起推送请求。
- API 返回和提醒文案不含敏感健康数据。
- 免费用户不能主动发送搭子提醒。

### B7. 高级小报告

已完成：

1. 实现 `GET /reports/advanced?range=90d`。
2. 实现 `GET /teams/current/reports/weekly`。
3. 两个接口都要求登录，并通过 Pro 权益校验。
4. `pro_active` 和 `pro_grace_period` 可访问；`free / pro_expired` 返回 `403 forbidden`。
5. 个人 90 天报告读取 `daily_report_snapshots` 最新摘要；没有数据时返回 `snapshot: null`。
6. 小队周报基于 `daily_share_snapshots` 聚合最近 7 天成员数据。
7. 小队周报只统计低敏字段：菊花抬营业天数、小账本满格天数、蹲会儿记过天数。
8. 小队周报会应用成员共享设置；暂停共享或关闭某项共享后，对应字段不会计入周报。
9. Mock 模式下支持 Pro 权益注入测试，方便无数据库开发。
10. 实现 `PUT /report-snapshots/today` 上传个人高级小报告摘要。
11. 上传接口要求 Pro 权益，免费用户不能产生云端报告数据。
12. 上传数据只允许低敏聚合字段，不允许便血、不适、排便感受和具体蹲会儿时长。

暂未实现：

- 高级小报告页面和 paywall。
- 90 天范围内多日明细展示，目前返回最新聚合摘要。
- 小队周报推送或定时生成。

验收：

- 免费用户被 paywall 拦截。
- Pro 用户可查询。
- 报告只基于低敏摘要。

## 15. 当前下一步

B1-B7.1 后端基础链路已经完成。下一步建议进入 **移动端 Pro 接入准备**：

1. 新增移动端 API client 和 token 存储。
2. 接入 Apple 登录按钮与 mock/dev 后端配置。
3. 新增 Pro paywall 占位页。
4. 接入 `/me/entitlements` 判断 Pro 状态。
5. 之后再开发小队 UI、搭子提醒 UI 和高级小报告页面。
