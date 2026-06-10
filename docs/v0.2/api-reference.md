# 小提督 v0.2 后端接口文档

版本：v0.2
日期：2026-06-10
阶段：开发联调版
关联文档：[v0.2 PRD](./prd.md)、[v0.2 开发方案](./development-plan.md)、[后端详细开发方案](./backend-development-plan.md)

## 1. 当前状态

本文档描述 `apps/api` 当前已经实现的 HTTP API。

Apifox 可导入文件：[openapi.json](./openapi.json)。

当前后端适合本地开发和移动端联调，还不是生产上线版本。

已完成：

- 账号登录接口骨架。
- Bearer token 鉴权。
- Pro 权益读取。
- 小队、邀请、成员管理。
- 低敏共享快照。
- 搭子提醒、提醒回执、提醒设置。
- Push token 注册与 Expo Push 发送层。
- 个人高级小报告和小队周报。

仍是占位或待完善：

- App Store 订阅真实校验。
- 后端支持真实 Apple identity token 校验；移动端真实 Apple 登录入口因签名能力限制已临时关闭。
- Push receipt 查询和重试队列。
- 真实 Postgres 集成测试。
- 并发强一致加固。

## 2. 基础约定

### 2.1 Base URL

本地默认：

```text
http://localhost:8787
```

### 2.2 响应结构

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
    "code": "validation_error",
    "message": "请求参数不符合预期。",
    "details": []
  }
}
```

### 2.3 鉴权

除特别说明外，业务接口需要 Bearer token：

```http
Authorization: Bearer <access_token>
```

token 来自：

```text
POST /auth/apple
```

### 2.4 Pro 权限

以下接口需要 Pro 权益，允许状态为：

- `pro_active`
- `pro_grace_period`

当前已加 Pro 限制的接口：

- `POST /teams`
- `POST /teams/current/invites`
- `POST /nudges`
- `GET /reports/advanced`
- `GET /teams/current/reports/weekly`
- `PUT /report-snapshots/today`
- `PUT /report-snapshots/bulk`

以下接口允许免费用户继续使用，便于取消订阅后保留关系和基本数据控制：

- 接受邀请。
- 查看已加入的小队。
- 修改自己的共享设置。
- 暂停/恢复自己的共享状态。
- 退出小队。
- 回复提醒回执。

### 2.5 隐私边界

云端只保存 Pro 功能必要的低敏数据。

不会上传：

- 明显便血。
- 明显不舒服。
- 具体蹲会儿时长。
- 排便感受。
- 原始训练明细。
- 自由文本聊天。

好友共享只基于 `daily_share_snapshots`，不会读取 `daily_report_snapshots`。

## 3. 通用类型

### 3.1 UserProfile

```ts
type UserProfile = {
  avatarUrl: null | string;
  id: string;
  nickname: null | string;
  timezone: string;
};
```

### 3.2 ProStatus

```ts
type ProStatus = 'free' | 'pro_active' | 'pro_grace_period' | 'pro_expired';
```

### 3.3 ShareSettings

```ts
type ShareSettings = {
  paused: boolean;
  shareHabitCompletion: boolean;
  shareStreak: boolean;
  shareToiletRecorded: boolean;
  shareTraining: boolean;
};
```

### 3.4 DailyShareSnapshot

```ts
type DailyShareSnapshot = {
  date: string; // YYYY-MM-DD
  habitCompletion: 0 | 1 | 2 | 3 | 4;
  streakDays: number;
  toiletRecorded: boolean;
  trainingDone: boolean;
};
```

### 3.5 DailyReportSnapshot

```ts
type DailyReportSnapshot = DailyShareSnapshot & {
  habitFull: boolean;
  toiletLongMeeting: boolean;
  weeklyHabitFullDays: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  weeklyToiletLongMeetingCount: number;
  weeklyTrainingDays: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  thirtyDayHabitFullDays: number;
  thirtyDayToiletLongMeetingCount: number;
  thirtyDayTrainingDays: number;
  ninetyDayHabitFullDays: number;
  ninetyDayToiletLongMeetingCount: number;
  ninetyDayTrainingDays: number;
};
```

### 3.6 AdvancedReportDay

```ts
type AdvancedReportDay = {
  date: string; // YYYY-MM-DD
  trainingDone: boolean;
  habitCompletion: 0 | 1 | 2 | 3 | 4;
  habitFull: boolean;
  toiletRecorded: boolean;
  toiletLongMeeting: boolean;
};
```

### 3.7 AdvancedReportSummary

```ts
type AdvancedReportSummary = {
  recordDays: number;
  trainingDays: number;
  habitFullDays: number;
  toiletRecordDays: number;
  toiletLongMeetingCount: number;
  currentStreakDays: number;
  hasAnyRecord: boolean;
};
```

### 3.8 AdvancedReportResponse

```ts
type AdvancedReportResponse = {
  range: '90d';
  startedAt: string; // YYYY-MM-DD
  endedAt: string; // YYYY-MM-DD
  summary: AdvancedReportSummary;
  days: AdvancedReportDay[];
  snapshot: DailyReportSnapshot | null;
};
```

## 4. 健康检查

### GET /health

鉴权：不需要

用途：检查 API 服务是否可用。

响应：

```json
{
  "data": {
    "ok": true,
    "service": "xiaotidu-api",
    "version": "0.2.0"
  }
}
```

### GET /health/db

鉴权：不需要

用途：检查数据库是否可达。

成功响应：

```json
{
  "data": {
    "ok": true,
    "database": "reachable"
  }
}
```

未配置数据库：

```json
{
  "error": {
    "code": "database_not_configured",
    "message": "数据库连接还没有配置。"
  }
}
```

数据库不可达：

```json
{
  "error": {
    "code": "database_unreachable",
    "message": "数据库暂时不可用。"
  }
}
```

## 5. 认证

### POST /auth/apple

鉴权：不需要

用途：使用 Apple identity token 登录或创建用户。

当前状态：

- `APPLE_AUTH_MODE=mock` 时使用 mock 校验，便于本地开发。
- `APPLE_AUTH_MODE=real` 时使用 Apple JWKS 校验 JWT。

请求：

```json
{
  "identityToken": "apple_identity_token",
  "authorizationCode": "optional_code",
  "nickname": "小提督用户"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| identityToken | string | 是 | Apple identity token |
| authorizationCode | string | 否 | Apple 授权码，当前未使用 |
| nickname | string | 否 | 昵称，1-40 字符 |

响应：

```json
{
  "data": {
    "token": "access_token",
    "user": {
      "avatarUrl": null,
      "id": "00000000-0000-4000-8000-000000000001",
      "nickname": "小提督用户",
      "timezone": "Asia/Shanghai"
    }
  }
}
```

### POST /auth/logout

鉴权：需要

用途：退出登录。

当前状态：需要 Bearer token，但只返回成功。服务端仍不维护 session 或 token 黑名单，客户端需要删除本地 token。

响应：

```json
{
  "data": {
    "ok": true
  }
}
```

## 6. 当前用户与权益

### GET /me

鉴权：需要

用途：获取当前用户资料。

响应：

```json
{
  "data": {
    "avatarUrl": null,
    "id": "user-id",
    "nickname": "小提督用户",
    "timezone": "Asia/Shanghai"
  }
}
```

### PATCH /me

鉴权：需要

用途：更新当前用户资料。用于小队和搭子互动里的轻社交展示。

请求：

```json
{
  "avatarUrl": "http://localhost:8787/mock-storage/avatars%2Fuser-id%2Favatar.jpg",
  "nickname": "搭子队长",
  "timezone": "Asia/Shanghai"
}
```

字段说明：

- `nickname`：1-20 个字符，可传 `null` 清空。
- `avatarUrl`：头像公开访问 URL。当前开发环境由头像上传骨架返回 `/mock-storage/...`，后续接正式对象存储后保存 CDN/对象存储 URL。
- `timezone`：可选，默认 `Asia/Shanghai`。

响应：

```json
{
  "data": {
    "avatarUrl": "http://localhost:8787/mock-storage/avatars%2Fuser-id%2Favatar.jpg",
    "id": "user-id",
    "nickname": "搭子队长",
    "timezone": "Asia/Shanghai"
  }
}
```

### POST /me/avatar-upload

鉴权：需要

用途：创建头像上传地址。当前是对象存储骨架，开发环境返回 mock 上传地址；后续接入正式 OSS/S3/R2 后，接口结构保持不变。

请求：

```json
{
  "contentLength": 48231,
  "contentType": "image/jpeg"
}
```

限制：

- `contentType`：只允许 `image/jpeg`、`image/png`、`image/webp`。
- `contentLength`：必须大于 0，最大 `300KB`。
- 上传地址有效期：当前 mock 为 5 分钟。

响应：

```json
{
  "data": {
    "expiresAt": "2026-05-26T10:05:00.000Z",
    "objectKey": "avatars/user-id/avatar-id.jpg",
    "publicUrl": "http://localhost:8787/mock-storage/avatars%2Fuser-id%2Favatar-id.jpg",
    "uploadMethod": "mock_put",
    "uploadUrl": "http://localhost:8787/mock-storage/avatars%2Fuser-id%2Favatar-id.jpg?token=upload-token"
  }
}
```

开发环境上传流程：

1. 调用 `POST /me/avatar-upload` 获取 `uploadUrl` 和 `publicUrl`。
2. 客户端用 `PUT uploadUrl` 上传压缩后的图片二进制。
3. 上传成功后调用 `PATCH /me`，把 `avatarUrl` 更新为 `publicUrl`。
4. 正式对象存储接入后，`uploadUrl` 会替换为预签名上传地址，数据库仍只保存 `publicUrl`。

### GET /me/entitlements

鉴权：需要

用途：获取当前用户会员权益。

响应：

```json
{
  "data": {
    "proStatus": "free"
  }
}
```

`proStatus` 可选值：

- `free`
- `pro_active`
- `pro_grace_period`
- `pro_expired`

## 7. 订阅

### POST /subscriptions/verify

鉴权：需要

用途：提交单笔 App Store 交易进行会员校验。

当前状态：占位接口，还没有接 App Store Server API，不会写入真实订阅。

请求：

```json
{
  "productId": "xiaotidu.pro.monthly",
  "transactionId": "transaction-id"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| productId | `xiaotidu.pro.monthly` 或 `xiaotidu.pro.yearly` | 是 | 商品 ID |
| transactionId | string | 是 | App Store 交易 ID |

响应：

```json
{
  "data": {
    "status": "pending_verification",
    "entitlements": {
      "proStatus": "free"
    }
  }
}
```

### POST /subscriptions/restore

鉴权：需要

用途：恢复购买。

当前状态：占位接口，还没有接 App Store Server API。

请求：

```json
{
  "transactionIds": ["transaction-id"]
}
```

规则：

- `transactionIds` 最少 1 个，最多 20 个。

响应：

```json
{
  "data": {
    "status": "pending_verification",
    "entitlements": {
      "proStatus": "free"
    }
  }
}
```

## 8. 小队

### POST /teams

鉴权：需要
Pro：需要

用途：创建自己的小队。

请求：

```json
{
  "name": "轻轻监督队"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 否 | 小队名，1-40 字符 |

响应：

```json
{
  "data": {
    "team": {
      "id": "team-id",
      "name": "轻轻监督队",
      "ownerUserId": "user-id",
      "members": []
    }
  }
}
```

### GET /teams/current

鉴权：需要

用途：获取当前用户所在小队。

响应：

```json
{
  "data": {
    "team": null
  }
}
```

或：

```json
{
  "data": {
    "team": {
      "id": "team-id",
      "name": "轻轻监督队",
      "ownerUserId": "owner-user-id",
      "members": [
        {
          "displayName": "队长",
          "id": "member-id",
          "joinedAt": "2026-05-25T00:00:00.000Z",
          "role": "owner",
          "status": "active",
          "user": {
            "avatarUrl": null,
            "id": "user-id",
            "nickname": "队长"
          }
        }
      ]
    }
  }
}
```

### PATCH /teams/current

鉴权：需要

用途：修改小队名称。

权限：只有小队创建者可操作。

请求：

```json
{
  "name": "新名字"
}
```

响应：同 `GET /teams/current`。

### POST /teams/current/leave

鉴权：需要

用途：退出小队。

规则：

- owner 退出会归档小队。
- buddy 退出只移除自己。

响应：同 `GET /teams/current`。

### POST /teams/current/invites

鉴权：需要
Pro：需要

用途：创建小队邀请。

规则：

- 只有小队 owner 可创建邀请。
- 小队最多 1 个 owner + 3 个 buddy。
- token 原文只在响应中返回一次，服务端只存 hash。

响应：

```json
{
  "data": {
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "inviteId": "invite-id",
    "inviteUrl": "xiaotidu://team/join/token",
    "token": "token"
  }
}
```

### DELETE /teams/current/members/:memberId

鉴权：需要

用途：移除小队成员。

权限：只有小队 owner 可操作。

规则：

- 不能移除 owner。
- 不能通过此接口移除自己。

响应：同 `GET /teams/current`。

### PATCH /teams/current/members/me/status

鉴权：需要

用途：暂停或恢复自己的共享状态。

请求：

```json
{
  "status": "paused"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | `active` 或 `paused` | 是 | 当前成员状态 |

响应：同 `GET /teams/current`。

### GET /teams/current/snapshots

鉴权：需要

用途：获取小队某天低敏共享快照。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| date | string | 否 | `YYYY-MM-DD`，默认今天 |

响应：

```json
{
  "data": {
    "date": "2026-05-25",
    "snapshots": [
      {
        "member": {
          "displayName": "队长",
          "id": "member-id",
          "role": "owner",
          "status": "active",
          "user": {
            "avatarUrl": null,
            "id": "user-id",
            "nickname": "队长"
          }
        },
        "shareSettings": {
          "paused": false,
          "shareHabitCompletion": true,
          "shareStreak": true,
          "shareToiletRecorded": true,
          "shareTraining": true
        },
        "snapshot": {
          "date": "2026-05-25",
          "habitCompletion": 4,
          "streakDays": 7,
          "toiletRecorded": true,
          "trainingDone": true
        }
      }
    ]
  }
}
```

共享过滤规则：

- `paused=true` 时，`snapshot=null`。
- 关闭某项共享后，对应字段不会出现在 `snapshot` 里。
- 成员状态为 `paused` 时，`snapshot=null`。

## 9. 小队邀请

### GET /team-invites/:token

鉴权：不需要

用途：预览邀请。

响应：

```json
{
  "data": {
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "inviterNickname": "队长",
    "teamName": "轻轻监督队"
  }
}
```

### POST /team-invites/:token/accept

鉴权：需要

用途：接受邀请加入小队。

请求：

```json
{
  "displayName": "监督搭子",
  "shareSettings": {
    "shareTraining": true,
    "shareHabitCompletion": true,
    "shareToiletRecorded": false,
    "shareStreak": true
  }
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| displayName | string | 否 | 在小队里的显示名，1-40 字符 |
| shareSettings | Partial\<ShareSettings\> | 否 | 初始共享设置 |

响应：同 `GET /teams/current`。

## 10. 共享设置和快照

### PUT /share-settings

鉴权：需要

用途：更新自己的小队共享设置。

请求：

```json
{
  "paused": false,
  "shareHabitCompletion": true,
  "shareStreak": true,
  "shareToiletRecorded": true,
  "shareTraining": true
}
```

响应：

```json
{
  "data": {
    "settings": {
      "paused": false,
      "shareHabitCompletion": true,
      "shareStreak": true,
      "shareToiletRecorded": true,
      "shareTraining": true
    }
  }
}
```

### PUT /share-snapshots/today

鉴权：需要

用途：上传今天的搭子可见低敏共享快照。

请求：

```json
{
  "snapshot": {
    "date": "2026-05-25",
    "habitCompletion": 3,
    "streakDays": 6,
    "toiletRecorded": true,
    "trainingDone": true
  }
}
```

响应：

```json
{
  "data": {
    "snapshot": {
      "date": "2026-05-25",
      "habitCompletion": 3,
      "streakDays": 6,
      "toiletRecorded": true,
      "trainingDone": true
    }
  }
}
```

## 11. 搭子提醒

### POST /nudges

鉴权：需要
Pro：需要

用途：主动提醒搭子。

请求：

```json
{
  "toUserId": "buddy-user-id",
  "type": "move"
}
```

`type` 可选值：

| type | 文案 |
| --- | --- |
| gentle | 轻轻戳一下，今天别空白。 |
| move | 起来活动一下，换个姿势。 |
| not_blank | 今天别空白，做一点也算数。 |
| habit_left | 小账本还差一点，顺手补一笔。 |
| posture | 该换个姿势了，别坐成雕像。 |

规则：

- 只能提醒同一小队 active 成员。
- 不能提醒自己。
- 每个搭子每日提醒上限默认 5 次。
- 上限可设为 `0 / 3 / 5 / 8`。
- `0` 或 `enabled=false` 等同关闭该搭子的主动提醒。
- 命中接收者免打扰时间时返回 `403 forbidden`。
- 免打扰和每日次数按接收者 `timezone` 计算。

响应：

```json
{
  "data": {
    "ack": null,
    "createdAt": "2026-05-25T00:00:00.000Z",
    "expiresAt": "2026-05-26T00:00:00.000Z",
    "fromUser": {
      "avatarUrl": null,
      "id": "owner-user-id",
      "nickname": "队长"
    },
    "id": "nudge-id",
    "messageTemplate": "起来活动一下，换个姿势。",
    "teamId": "team-id",
    "toUser": {
      "avatarUrl": null,
      "id": "buddy-user-id",
      "nickname": "搭子"
    },
    "type": "move"
  }
}
```

### GET /nudges/inbox

鉴权：需要

用途：查询收到的提醒。

响应：

```json
{
  "data": {
    "nudges": []
  }
}
```

### GET /nudges/sent

鉴权：需要

用途：查询发出的提醒。

响应：

```json
{
  "data": {
    "nudges": []
  }
}
```

### POST /nudges/:id/ack

鉴权：需要

用途：对收到的提醒进行固定回执。

请求：

```json
{
  "status": "received"
}
```

`status` 可选值：

- `received`：收到
- `later`：等会儿
- `done`：已完成

规则：

- 只能回复发给自己的提醒。
- 每条提醒只能创建一次回执。
- 30 分钟内允许修改一次。
- 不支持自由文本。

响应：

```json
{
  "data": {
    "ack": {
      "createdAt": "2026-05-25T00:00:00.000Z",
      "revisionCount": 0,
      "status": "received",
      "updatedAt": "2026-05-25T00:00:00.000Z"
    }
  }
}
```

## 12. 搭子提醒设置

### GET /buddy-nudge-settings

鉴权：需要

用途：查询当前用户对每个搭子的提醒设置。

响应：

```json
{
  "data": {
    "settings": [
      {
        "buddyUserId": "buddy-user-id",
        "dailyLimit": 5,
        "enabled": true,
        "quietRanges": [],
        "teamId": "team-id",
        "userId": "user-id"
      }
    ]
  }
}
```

### PUT /buddy-nudge-settings/:buddyUserId

鉴权：需要

用途：更新某个搭子提醒自己的权限和频率。

请求：

```json
{
  "dailyLimit": 5,
  "enabled": true,
  "quietRanges": [
    {
      "start": "12:30",
      "end": "14:00"
    },
    {
      "start": "23:00",
      "end": "08:00"
    }
  ]
}
```

规则：

- `dailyLimit` 只能是 `0 / 3 / 5 / 8`。
- `quietRanges` 最多 4 段。
- 时间格式必须是 `HH:mm`，范围为 `00:00-23:59`。
- `start=end` 表示全天免打扰。
- 跨天时间段合法，例如 `23:00-08:00`。

响应：

```json
{
  "data": {
    "settings": [
      {
        "buddyUserId": "buddy-user-id",
        "dailyLimit": 5,
        "enabled": true,
        "quietRanges": [
          {
            "start": "12:30",
            "end": "14:00"
          }
        ],
        "teamId": "team-id",
        "userId": "user-id"
      }
    ]
  }
}
```

## 13. Push Token

### POST /push-tokens

鉴权：需要

用途：注册或更新设备推送 token。

请求：

```json
{
  "platform": "ios",
  "provider": "expo",
  "token": "ExponentPushToken[...]",
  "deviceId": "device-id"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| platform | `ios` 或 `android` | 是 | 设备平台 |
| provider | `expo` 或 `apns` | 是 | 推送服务 |
| token | string | 是 | 推送 token，最长 300 字符 |
| deviceId | string | 否 | 设备标识，最长 120 字符 |

响应：

```json
{
  "data": {
    "id": "push-token-id"
  }
}
```

## 14. 高级小报告

### GET /reports/advanced

鉴权：需要
Pro：需要

用途：查询个人 90 天高级小报告。服务端按当前用户 `timezone` 计算最近 90 天窗口，`days` 按日期升序返回。`snapshot` 保留窗口内最新一天记录，用于兼容旧调用方。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| range | `90d` | 否 | 当前只支持 `90d` |

响应：

示例中的 `days` 仅展示一条，实际响应会返回 90 天窗口内的完整每日序列。

```json
{
  "data": {
    "range": "90d",
    "startedAt": "2026-03-13",
    "endedAt": "2026-06-10",
    "summary": {
      "recordDays": 0,
      "trainingDays": 0,
      "habitFullDays": 0,
      "toiletRecordDays": 0,
      "toiletLongMeetingCount": 0,
      "currentStreakDays": 0,
      "hasAnyRecord": false
    },
    "days": [
      {
        "date": "2026-03-13",
        "trainingDone": false,
        "habitCompletion": 0,
        "habitFull": false,
        "toiletRecorded": false,
        "toiletLongMeeting": false
      }
    ],
    "snapshot": null
  }
}
```

有快照时：

```json
{
  "data": {
    "range": "90d",
    "startedAt": "2026-03-13",
    "endedAt": "2026-06-10",
    "summary": {
      "recordDays": 45,
      "trainingDays": 36,
      "habitFullDays": 24,
      "toiletRecordDays": 39,
      "toiletLongMeetingCount": 2,
      "currentStreakDays": 9,
      "hasAnyRecord": true
    },
    "days": [
      {
        "date": "2026-06-10",
        "trainingDone": true,
        "habitCompletion": 4,
        "habitFull": true,
        "toiletRecorded": true,
        "toiletLongMeeting": false
      }
    ],
    "snapshot": {
      "date": "2026-06-10",
      "habitCompletion": 4,
      "habitFull": true,
      "ninetyDayHabitFullDays": 24,
      "ninetyDayToiletLongMeetingCount": 2,
      "ninetyDayTrainingDays": 36,
      "streakDays": 9,
      "thirtyDayHabitFullDays": 10,
      "thirtyDayToiletLongMeetingCount": 1,
      "thirtyDayTrainingDays": 13,
      "toiletLongMeeting": false,
      "toiletRecorded": true,
      "trainingDone": true,
      "weeklyHabitFullDays": 4,
      "weeklyToiletLongMeetingCount": 0,
      "weeklyTrainingDays": 5
    }
  }
}
```

### PUT /report-snapshots/today

鉴权：需要
Pro：需要

用途：上传单日个人高级小报告摘要。

注意：该快照只用于用户自己的高级报告，不给搭子看。移动端当前主要使用批量上传接口补齐最近 90 天，单日接口保留用于兼容和调试。

请求：

```json
{
  "snapshot": {
    "date": "2026-05-25",
    "habitCompletion": 4,
    "habitFull": true,
    "ninetyDayHabitFullDays": 24,
    "ninetyDayToiletLongMeetingCount": 2,
    "ninetyDayTrainingDays": 36,
    "streakDays": 9,
    "thirtyDayHabitFullDays": 10,
    "thirtyDayToiletLongMeetingCount": 1,
    "thirtyDayTrainingDays": 13,
    "toiletLongMeeting": false,
    "toiletRecorded": true,
    "trainingDone": true,
    "weeklyHabitFullDays": 4,
    "weeklyToiletLongMeetingCount": 0,
    "weeklyTrainingDays": 5
  }
}
```

响应：

```json
{
  "data": {
    "snapshot": {
      "date": "2026-05-25",
      "habitCompletion": 4,
      "habitFull": true,
      "ninetyDayHabitFullDays": 24,
      "ninetyDayToiletLongMeetingCount": 2,
      "ninetyDayTrainingDays": 36,
      "streakDays": 9,
      "thirtyDayHabitFullDays": 10,
      "thirtyDayToiletLongMeetingCount": 1,
      "thirtyDayTrainingDays": 13,
      "toiletLongMeeting": false,
      "toiletRecorded": true,
      "trainingDone": true,
      "weeklyHabitFullDays": 4,
      "weeklyToiletLongMeetingCount": 0,
      "weeklyTrainingDays": 5
    }
  }
}
```

### PUT /report-snapshots/bulk

鉴权：需要
Pro：需要

用途：批量上传个人高级小报告摘要，单批最多 90 条。

规则：

- 请求体验证失败时，整批拒绝。
- 同一批内同一天重复数据保留请求内最后一条。
- 服务端按 `userId + date` upsert。
- 该快照只用于用户自己的高级报告，不给搭子看。

请求：

```json
{
  "snapshots": [
    {
      "date": "2026-06-09",
      "habitCompletion": 2,
      "habitFull": false,
      "ninetyDayHabitFullDays": 23,
      "ninetyDayToiletLongMeetingCount": 2,
      "ninetyDayTrainingDays": 35,
      "streakDays": 8,
      "thirtyDayHabitFullDays": 9,
      "thirtyDayToiletLongMeetingCount": 1,
      "thirtyDayTrainingDays": 12,
      "toiletLongMeeting": false,
      "toiletRecorded": true,
      "trainingDone": false,
      "weeklyHabitFullDays": 3,
      "weeklyToiletLongMeetingCount": 0,
      "weeklyTrainingDays": 4
    },
    {
      "date": "2026-06-10",
      "habitCompletion": 4,
      "habitFull": true,
      "ninetyDayHabitFullDays": 24,
      "ninetyDayToiletLongMeetingCount": 2,
      "ninetyDayTrainingDays": 36,
      "streakDays": 9,
      "thirtyDayHabitFullDays": 10,
      "thirtyDayToiletLongMeetingCount": 1,
      "thirtyDayTrainingDays": 13,
      "toiletLongMeeting": false,
      "toiletRecorded": true,
      "trainingDone": true,
      "weeklyHabitFullDays": 4,
      "weeklyToiletLongMeetingCount": 0,
      "weeklyTrainingDays": 5
    }
  ]
}
```

响应：

```json
{
  "data": {
    "snapshots": [
      {
        "date": "2026-06-09",
        "habitCompletion": 2,
        "habitFull": false,
        "ninetyDayHabitFullDays": 23,
        "ninetyDayToiletLongMeetingCount": 2,
        "ninetyDayTrainingDays": 35,
        "streakDays": 8,
        "thirtyDayHabitFullDays": 9,
        "thirtyDayToiletLongMeetingCount": 1,
        "thirtyDayTrainingDays": 12,
        "toiletLongMeeting": false,
        "toiletRecorded": true,
        "trainingDone": false,
        "weeklyHabitFullDays": 3,
        "weeklyToiletLongMeetingCount": 0,
        "weeklyTrainingDays": 4
      },
      {
        "date": "2026-06-10",
        "habitCompletion": 4,
        "habitFull": true,
        "ninetyDayHabitFullDays": 24,
        "ninetyDayToiletLongMeetingCount": 2,
        "ninetyDayTrainingDays": 36,
        "streakDays": 9,
        "thirtyDayHabitFullDays": 10,
        "thirtyDayToiletLongMeetingCount": 1,
        "thirtyDayTrainingDays": 13,
        "toiletLongMeeting": false,
        "toiletRecorded": true,
        "trainingDone": true,
        "weeklyHabitFullDays": 4,
        "weeklyToiletLongMeetingCount": 0,
        "weeklyTrainingDays": 5
      }
    ]
  }
}
```

### GET /teams/current/reports/weekly

鉴权：需要
Pro：需要

用途：查询小队近 7 天周报。

规则：

- 只基于 `daily_share_snapshots` 聚合。
- 会遵守成员共享设置。
- 成员暂停共享后不计入周报。

响应：

```json
{
  "data": {
    "startedAt": "2026-05-19",
    "endedAt": "2026-05-25",
    "memberCount": 2,
    "summaries": [
      {
        "member": {
          "displayName": "队长",
          "id": "member-id",
          "user": {
            "avatarUrl": null,
            "id": "user-id",
            "nickname": "队长"
          }
        },
        "trainingDays": 4,
        "habitFullDays": 3,
        "toiletRecordedDays": 2
      }
    ]
  }
}
```

## 15. 常见错误码

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `bad_request` | 参数语义错误 |
| 400 | `validation_error` | Zod 入参校验失败 |
| 401 | `unauthorized` | 未登录或 token 无效 |
| 403 | `forbidden` | 无权限、非 Pro、不可提醒 |
| 404 | `not_found` | 资源不存在 |
| 409 | `conflict` | 状态冲突，例如邀请已使用 |
| 429 | `rate_limited` | 达到每日提醒上限 |
| 503 | `database_not_configured` | 未配置数据库 |
| 503 | `database_unreachable` | 数据库不可达 |
| 500 | `internal_server_error` | 未预期服务错误 |

## 16. 本地调试示例

### 16.1 启动 API

```bash
pnpm api:start
```

### 16.2 登录并获取 token

```bash
curl -s -X POST http://localhost:8787/auth/apple \
  -H "Content-Type: application/json" \
  -d '{"identityToken":"test-token","nickname":"测试用户"}'
```

### 16.3 调用鉴权接口

```bash
curl http://localhost:8787/me \
  -H "Authorization: Bearer <token>"
```

### 16.4 检查数据库

```bash
curl http://localhost:8787/health/db
```

如果未配置 `DATABASE_URL`，会返回结构化 503；这是开发环境允许的状态。

## 17. 移动端接入顺序建议

建议移动端按以下顺序接入：

1. `POST /auth/apple`
2. `GET /me`
3. `GET /me/entitlements`
4. Pro Paywall 占位和权限判断
5. `POST /teams`、`GET /teams/current`
6. `POST /teams/current/invites`
7. `GET /team-invites/:token`、`POST /team-invites/:token/accept`
8. `PUT /share-settings`
9. `PUT /share-snapshots/today`
10. `GET /teams/current/snapshots`
11. `POST /push-tokens`
12. `POST /nudges`、`GET /nudges/inbox`、`POST /nudges/:id/ack`
13. `GET /reports/advanced`
14. `PUT /report-snapshots/bulk`
15. `GET /teams/current/reports/weekly`
