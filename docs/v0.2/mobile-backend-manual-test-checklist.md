# 小提督 v0.2 移动端后端联调手动测试清单

> 历史说明：本文中的小队、监督搭子和共享快照检查项已失效；好友链路以[好友关系重构](./friends-refactor.md)和自动化测试为准。

版本：v0.2
日期：2026-07-13
适用范围：移动端接入后端后的本地联调

执行记录：

- 日期：待填写
- Mac / iPhone / iOS：待填写
- API commit：待填写
- 测试账号：`mock-user-a` / `mock-user-b` / `mock-user-c`
- 结果与问题链接：待填写

## 1. 测试前准备

- [ ] 已启动本地 PostgreSQL。
- [ ] 已创建数据库 `xiaotidu`。
- [ ] `apps/api/.env` 已配置本地 `DATABASE_URL`。
- [ ] 已执行数据库迁移：

```bash
pnpm --filter @xiaotidu/api db:migrate
```

- [ ] 后端可启动：

```bash
pnpm api:start
```

- [ ] 后端健康检查通过：

```bash
curl http://localhost:8787/health
curl http://localhost:8787/health/db
```

预期：

- [ ] `/health` 返回 `xiaotidu-api`。
- [ ] `/health/db` 返回 `database: reachable`。

- [ ] iOS 模拟器可启动：

```bash
pnpm mobile:ios
```

## 2. 未登录基础功能回归

- [ ] App 可以正常进入首页。
- [ ] 首页不强制登录。
- [ ] 菊花抬可进入模式选择页。
- [ ] 菊花抬可开始训练。
- [ ] 菊花抬完成后可回到首页。
- [ ] 蹲会儿可开始计时。
- [ ] 蹲会儿可收工并保存记录。
- [ ] 小账本可在首页快速打卡。
- [ ] 小账本详情页可切换三档状态。
- [ ] 最近小报告可打开。
- [ ] 首页右上角可以进入 `我的`。
- [ ] 设置页不显示登录、Pro 或小队管理入口。

## 3. Mock 登录与我的页

- [ ] 进入 `我的`。
- [ ] 确认开发登录区只在非生产构建显示。
- [ ] 选择 `mock-user-a` 并点击 `开发 Mock 登录`。
- [ ] 登录后显示资料摘要、权益状态和用户 ID。
- [ ] Pro 状态显示为 `免费版`。
- [ ] `我的` 页默认不显示昵称输入框和头像网格。
- [ ] 点击 `编辑资料` 进入 `编辑资料` 页。
- [ ] 修改昵称并点击 `保存资料`，保存成功后回到 `我的`。
- [ ] 再次进入 `编辑资料`，点击 `更换头像` 后背景色和头像网格展开，网格选项不显示文字标签或外框。
- [ ] 分别选择一个背景色和一个 emoji 头像后预览更新，再点击 `保存资料`。
- [ ] `我的` 页头像更新。
- [ ] 重新进入 `我的` 后头像仍保留。
- [ ] 点击 `刷新` 后用户信息仍正常。
- [ ] `我的` 页能进入 `小提督 Pro`、`监督搭子`、`高级小报告` 和 `Apple Watch`。
- [ ] 点击 `退出登录` 后回到未登录状态。
- [ ] 退出登录后，本地菊花抬、蹲会儿、小账本记录仍保留。

## 3.1 真实 Apple 登录（暂缓）

当前暂缓原因：

- 免费 Personal Team 不支持 `Sign in with Apple` 和 Push Notifications capability。
- `ios.usesAppleSignIn` 与 `com.apple.developer.applesignin` 仍未恢复。
- `aps-environment` 由动态 Expo 配置按 EAS profile 注入：development 使用 `development`，preview / production 使用 `production`；未指定构建 profile 的本地配置默认不注入。

后续恢复测试时再执行：

- [ ] `apps/api/.env` 中 `APPLE_AUTH_MODE=real`。
- [ ] `apps/api/.env` 中 `APPLE_BUNDLE_ID=com.kex.xiaotidu`。
- [ ] App 重新开启 `ios.usesAppleSignIn` 和 `com.apple.developer.applesignin`。
- [ ] 进入 `我的`。
- [ ] 点击 `Sign in with Apple`。
- [ ] 系统弹出 Apple 授权面板。
- [ ] 授权成功后，`我的` 页显示用户和权益状态。
- [ ] 后端 `users` 表出现对应 Apple 用户。
- [ ] `/me` 和 `/me/entitlements` 能用返回的 token 正常访问。
- [ ] 取消 Apple 授权时不报错、不改变当前登录状态。

## 4. 免费用户 Pro 门槛

- [ ] 登录后进入 `监督搭子`。
- [ ] 免费用户无小队时显示创建引导。
- [ ] 点击创建小队。
- [ ] 预期进入 `小提督 Pro` 页面。
- [ ] 不应直接展示后端 403 原始错误。
- [ ] Pro 页面展示：
  - [ ] 监督搭子
  - [ ] Apple Watch 联动
  - [ ] 高级小报告
- [ ] 购买/恢复订阅按钮显示开发中或不可用状态。

## 5. 手动开通 Pro

在后端数据库中为当前 Mock 用户写入 active 订阅：

```bash
psql xiaotidu
```

```sql
insert into subscriptions (
  user_id,
  product_id,
  original_transaction_id,
  latest_transaction_id,
  environment,
  status,
  expires_at,
  auto_renew_status,
  last_verified_at
)
select
  id,
  'xiaotidu.pro.monthly',
  'manual-test-mobile-user',
  'manual-test-mobile-user',
  'sandbox',
  'active',
  now() + interval '30 days',
  'on',
  now()
from users
where apple_user_id = 'mock:mock-user-a'
on conflict (original_transaction_id)
do update set
  status = 'active',
  expires_at = now() + interval '30 days',
  updated_at = now();
```

- [ ] 回到 App 的 `我的` 页。
- [ ] 点击 `刷新`。
- [ ] Pro 状态变为 `Pro 已开启`。

## 6. 小队创建与邀请

- [ ] Pro 状态下进入 `监督搭子`。
- [ ] 点击 `创建小队`。
- [ ] 创建成功后显示小队名称和成员数。
- [ ] 小队成员中包含当前用户。
- [ ] 小队成员卡展示当前用户昵称、预设 emoji 和背景色头像。
- [ ] 点击 `邀请搭子`。
- [ ] 邀请页生成邀请链接。
- [ ] 页面显示邀请二维码、邀请链接和有效期。
- [ ] 点击 `分享邀请` 能调起系统分享面板。
- [ ] 点击 `复制链接` 显示复制成功反馈。
- [ ] 点击 `生成新链接` 能生成新的邀请。
- [ ] 邀请生成失败时显示轻量错误文案。

## 7. 接受邀请

使用开发环境用户切换完成完整双用户流程：

- [ ] `mock-user-a` 创建小队和邀请，保留邀请 token / 链接。
- [ ] 在 `我的` 开发登录区切换到 `mock-user-b`。
- [ ] 确认切换后旧用户 Query cache 已清空，本机健康记录仍保留。
- [ ] `mock-user-b` 打开邀请链接并预览邀请。
- [ ] `mock-user-b` 接受邀请并看到小队。
- [ ] 切换回 `mock-user-a`，刷新后成员数增加。
- [ ] 用 `mock-user-c` 验证已使用、过期、满员和已在其他小队的错误状态。

## 8. 共享快照同步

登录后完成本地动作：

- [ ] 完成一次菊花抬。
- [ ] 首页小账本打卡至少一项。
- [ ] 保存一次蹲会儿记录。
- [ ] 回到 App 前台或重新进入首页。

检查数据库：

```bash
psql xiaotidu -c "select * from daily_share_snapshots order by updated_at desc limit 5;"
```

预期：

- [ ] 有当前用户今日快照。
- [ ] `training_done` 只表示是否达到建议量。
- [ ] `habit_completion` 为 `0-4`。
- [ ] `toilet_recorded` 只表示是否记过。
- [ ] 不包含具体蹲会儿时长。
- [ ] 不包含明显便血或明显不舒服。

## 9. 高级报告快照同步

前提：当前用户为 Pro。

- [ ] 完成本地动作后回到 App 前台。
- [ ] 检查数据库：

```bash
psql xiaotidu -c "select * from daily_report_snapshots order by updated_at desc limit 5;"
```

预期：

- [ ] 最多有当前用户最近 90 天的日级高级报告快照。
- [ ] 每条只包含 `date`、`habit_completion`、`streak_days`、`toilet_recorded`、`training_done` 和 `toilet_long_meeting`。
- [ ] Pro 用户触发批量同步时，最多上传最近 90 天快照。
- [ ] 免费用户不会上传高级报告快照。
- [ ] 不包含原始健康明细。
- [ ] `GET /reports/advanced?range=90d` 在读取时返回独立的 `7d`、`30d`、`90d` 汇总。

进入 App：

- [ ] 打开 `最近小报告`。
- [ ] Pro 用户能看到 `90 天回看` 区域。
- [ ] 进入 `90 天回看` 后默认显示当前月份，可左右滑动切换月份。
- [ ] 点击有记录的日期能看到当天低敏详情弹窗。
- [ ] 无云端快照时显示空状态，不崩溃。

## 10. 小队共享设置

- [ ] 进入 `小队设置`。
- [ ] 修改小队名称。
- [ ] 名称保存后返回小队页显示新名称。
- [ ] 关闭 `菊花抬状态` 共享。
- [ ] 小队页对应成员不再展示菊花抬状态。
- [ ] 关闭 `小账本完成度` 共享。
- [ ] 小队页对应成员不再展示小账本完成度。
- [ ] 关闭 `蹲会儿是否记过` 共享。
- [ ] 小队页对应成员不再展示蹲会儿状态。
- [ ] 打开 `暂停共享`。
- [ ] 小队页显示暂停共享或不再展示快照。
- [ ] 恢复共享后状态可再次显示。

## 11. 搭子提醒与回执

前提：小队中至少有两个成员。

- [ ] 进入搭子详情页。
- [ ] 免费用户主动提醒时被引导到 Pro 或显示 Pro 限制。
- [ ] Pro 用户可以发送固定提醒：
  - [ ] 起来活动一下
  - [ ] 今天别空白
  - [ ] 小账本还差一点
  - [ ] 该换个姿势了
- [ ] 不存在自由文本输入。
- [ ] 进入提醒线程列表并选择对应搭子。
- [ ] 线程按游标分页展示双方提醒，进入后台或页面失焦后停止 15 秒刷新。
- [ ] 可选择回执：
  - [ ] 收到
  - [ ] 等会儿
  - [ ] 已完成
- [ ] 回执后提醒卡显示已回执状态。
- [ ] 同一线程内发出的提醒显示对方回执状态。

## 12. 搭子提醒设置

- [ ] 进入搭子详情页。
- [ ] 可设置该搭子每日提醒上限：
  - [ ] 关闭
  - [ ] 3 次
  - [ ] 5 次
  - [ ] 8 次
- [ ] 选择 `关闭` 后，对方不能继续主动提醒。
- [ ] 可设置勿扰时间：
  - [ ] 关闭勿扰
  - [ ] 午休
  - [ ] 夜间
  - [ ] 午休+夜间
- [ ] 当前勿扰范围展示正确。
- [ ] 命中勿扰时，后端阻止提醒并返回可理解错误。

## 13. Push token 注册

前提：登录后且系统通知权限已允许。

- [ ] App 回到前台后尝试注册 Expo Push Token。
- [ ] 注册失败不影响主流程。
- [ ] 数据库中 `push_tokens` 有当前用户 token。

检查：

```bash
psql xiaotidu -c "select user_id, provider, platform, enabled, last_seen_at from push_tokens order by updated_at desc limit 5;"
```

## 14. 退出登录

- [ ] 已登录状态进入账号页。
- [ ] 点击退出登录。
- [ ] 服务端当前 refresh session 被撤销，SecureStore 中 access / refresh token 被清除。
- [ ] 设置页回到未登录状态。
- [ ] 小队入口回到登录引导。
- [ ] 本地健康记录仍保留。
- [ ] 云端接口不再自动调用需要登录的接口。

## 15. 错误与离线

- [ ] 关闭后端服务。
- [ ] App 首页仍可打开。
- [ ] 本地菊花抬、蹲会儿、小账本仍可用。
- [ ] 云端入口显示轻量错误，不崩溃。
- [ ] 重新启动后端后，刷新可恢复。
- [ ] access token 失效时只刷新并重放一次；refresh 失败后才清理登录状态并提示重新登录。

## 16. 当前已知限制

- [ ] 真实 Apple 登录 UI 已临时关闭，等待 Apple Developer Program / 签名能力准备好后恢复。
- [ ] 真实订阅购买和恢复尚未接入。
- [ ] Mock 用户切换仅用于 development，preview / production 不显示该入口。
- [ ] 真机 API 地址不能用 `localhost`，需要改成 Mac 局域网 IP 或远程地址。
- [ ] Push 通知真机表现需要付费 Apple Developer Team 对应的 development build 或正式构建验证；配置映射通过不代表远程通知收发已通过。
