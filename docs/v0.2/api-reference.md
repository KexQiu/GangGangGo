# 小提督 API 参考

此文件由 `pnpm --filter @xiaotidu/api docs:generate` 生成。请求与响应结构以 `@xiaotidu/contracts` 的 Zod schema 为准。

## 认证

登录返回 15 分钟 access token 和 30 天 refresh token。除登录、刷新、健康检查和邀请预览外，接口使用 `Authorization: Bearer <accessToken>`。

## 接口

- `GET /health`：服务健康检查
- `POST /auth/apple`：Apple 或开发 Mock 登录
- `POST /auth/refresh`：轮换登录会话
- `POST /auth/logout`：撤销当前会话
- `GET /me`：当前用户
- `PATCH /me`：更新用户资料
- `GET /me/entitlements`：会员权益
- `POST /teams`：创建小队
- `GET /teams/current`：当前小队
- `PATCH /teams/current`：更新小队
- `POST /teams/current/leave`：退出小队
- `POST /teams/current/invites`：创建邀请
- `GET /team-invites/{token}`：预览邀请
- `POST /team-invites/{token}/accept`：接受邀请
- `PUT /share-settings`：更新共享设置
- `PUT /share-snapshots/today`：上传今日共享快照
- `GET /teams/current/snapshots`：小队今日快照
- `POST /nudges`：发送搭子提醒
- `GET /nudges/inbox`：提醒收件箱
- `GET /nudges/sent`：提醒发件箱
- `GET /nudges/threads`：提醒会话摘要
- `GET /nudges/threads/{buddyUserId}`：提醒会话详情
- `POST /nudges/{id}/ack`：回复提醒
- `GET /buddy-nudge-settings`：提醒设置
- `PUT /buddy-nudge-settings/{buddyUserId}`：更新提醒设置
- `POST /push-tokens`：注册 Push token
- `POST /subscriptions/verify`：提交订阅校验
- `POST /subscriptions/restore`：恢复订阅
- `PUT /report-snapshots/today`：上传个人日报
- `PUT /report-snapshots/bulk`：批量上传个人日报
- `GET /reports/advanced`：90 天高级报告
- `GET /teams/current/reports/weekly`：小队周报
