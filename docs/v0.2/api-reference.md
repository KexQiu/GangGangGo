# 小提督 API 参考

此文件由 `pnpm --filter @xiaotidu/api docs:generate` 生成。请求、响应和错误结构直接来自 `@xiaotidu/contracts`，接口登记来自 Hono OpenAPI 路由声明。

## 认证

登录返回 15 分钟 access token 和 30 天 refresh token。除登录、刷新、健康检查和邀请预览外，接口使用 `Authorization: Bearer <accessToken>`。

## 接口

- `GET /health`：服务健康检查
- `GET /health/db`：数据库健康检查
- `POST /auth/apple`：Apple 或开发 Mock 登录
- `POST /auth/refresh`：轮换登录会话
- `POST /auth/logout`：撤销当前会话
- `PUT /data-sync/push`：上传完整记录变更
- `GET /data-sync/pull`：增量拉取完整记录
- `GET /me`：当前用户
- `PATCH /me`：更新用户资料
- `GET /me/entitlements`：会员权益
- `POST /friend-invites`：创建好友邀请
- `GET /friend-invites/{token}`：预览好友邀请
- `POST /friend-invites/{token}/accept`：接受好友邀请
- `GET /friends`：好友列表
- `DELETE /friends/{friendUserId}`：删除好友及互动历史
- `GET /friends/{friendUserId}`：好友详情
- `PATCH /friends/{friendUserId}/settings`：更新好友权限与提醒设置
- `GET /friends/{friendUserId}/data`：读取好友授权数据
- `GET /friends/{friendUserId}/events`：好友互动时间线
- `POST /friends/{friendUserId}/nudges`：发送好友提醒
- `POST /friend-events/{eventId}/ack`：回复好友提醒
- `POST /push-tokens`：注册 Push token
- `POST /subscriptions/verify`：提交订阅校验
- `POST /subscriptions/restore`：恢复订阅
- `GET /reports/advanced`：90 天高级报告
- `PUT /report-snapshots/today`：上传个人日报
- `PUT /report-snapshots/bulk`：批量上传个人日报
