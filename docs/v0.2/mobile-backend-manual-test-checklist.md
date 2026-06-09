# 小提督 v0.2 移动端后端联调手动测试清单

版本：v0.2
日期：2026-05-25
适用范围：移动端接入后端后的本地联调

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
- [ ] 点击 `Mock Apple 登录`。
- [ ] 登录后显示昵称 `小提督用户` 或用户信息。
- [ ] Pro 状态显示为 `免费版`。
- [ ] 修改昵称并点击 `保存资料`。
- [ ] 页面昵称更新。
- [ ] 点击 `从相册选择头像`。
- [ ] 允许相册权限。
- [ ] 选择一张图片并确认裁剪。
- [ ] 头像上传成功后，`我的` 页头像更新。
- [ ] 重新进入 `我的` 后头像仍保留。
- [ ] 点击 `刷新` 后用户信息仍正常。
- [ ] `我的` 页能进入 `小提督 Pro`、`监督搭子`、`搭子提醒` 和 `高级小报告`。
- [ ] 点击 `退出登录` 后回到未登录状态。
- [ ] 退出登录后，本地菊花抬、蹲会儿、小账本记录仍保留。

## 3.1 真实 Apple 登录（暂缓）

当前暂缓原因：

- [ ] 免费 Personal Team 不支持 `Sign in with Apple` 和 Push Notifications capability。
- [ ] 当前已移除 `ios.usesAppleSignIn`、`com.apple.developer.applesignin` 和 `aps-environment`，方便继续模拟器构建。

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
where apple_user_id = 'mock-mobile-mock-user'
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
- [ ] 小队成员卡展示当前用户昵称和自定义头像。
- [ ] 点击 `邀请搭子`。
- [ ] 邀请页生成邀请链接。
- [ ] 页面显示邀请二维码、邀请链接和有效期。
- [ ] 点击 `分享邀请` 能调起系统分享面板。
- [ ] 点击 `复制链接` 显示复制成功反馈。
- [ ] 点击 `生成新链接` 能生成新的邀请。
- [ ] 邀请生成失败时显示轻量错误文案。

## 7. 接受邀请

当前移动端 Mock 登录固定为同一测试用户，完整双用户测试建议后续增加“切换 Mock 用户”入口。

可先使用接口验证接受邀请：

- [ ] 使用第二个 identity token 调用 `POST /auth/apple` 获取第二用户 token。
- [ ] 使用邀请 token 调用 `POST /team-invites/:token/accept`。
- [ ] 第二用户成功加入小队。
- [ ] 回到 App 小队页并刷新。
- [ ] 小队成员数增加。

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

- [ ] 有当前用户今日高级报告快照。
- [ ] 包含 7/30/90 天聚合字段。
- [ ] 不包含原始健康明细。

进入 App：

- [ ] 打开 `最近小报告`。
- [ ] Pro 用户能看到 `90 天回看` 区域。
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
- [ ] 进入 `搭子提醒` 页面。
- [ ] 收件箱可以展示收到的提醒。
- [ ] 可选择回执：
  - [ ] 收到
  - [ ] 等会儿
  - [ ] 已完成
- [ ] 回执后提醒卡显示已回执状态。
- [ ] 已发送列表显示对方回执状态。

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
- [ ] 本地 token 被清除。
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
- [ ] token 失效时，App 清理登录状态并提示重新登录。

## 16. 当前已知限制

- [ ] 真实 Apple 登录 UI 已临时关闭，等待 Apple Developer Program / 签名能力准备好后恢复。
- [ ] 真实订阅购买和恢复尚未接入。
- [ ] 当前移动端 Mock 登录固定为同一个测试用户。
- [ ] 双用户完整流程需要接口辅助或后续增加开发环境用户切换入口。
- [ ] 真机 API 地址不能用 `localhost`，需要改成 Mac 局域网 IP 或远程地址。
- [ ] Push 通知真机表现需要 development build 或正式构建验证。
