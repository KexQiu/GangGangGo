# 小提督 / GangGangGo

小提督是一个本地优先的健康习惯 App。仓库使用 pnpm workspace：

- `apps/mobile`：Expo + React Native、iOS Live Activity、Apple Watch。
- `apps/api`：Hono + Postgres + Drizzle API。
- `packages/contracts`：跨端 Zod schema 与 TypeScript 类型。

## Mac 开发环境

需要 Node.js 22-24、pnpm 10.32+、Xcode 和 PostgreSQL。仓库通过 `.nvmrc` 推荐 Node 22，CI 也使用 Node 22。Android 构建额外需要 Android Studio / SDK 36 与 OpenJDK 17。首次安装：

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @xiaotidu/api db:migrate
```

常用命令：

```bash
pnpm api:dev
pnpm build
pnpm api:start
pnpm mobile:ios
pnpm mobile:dev-client
pnpm check
```

移动端双用户联调需要本地 API、Metro 和一个已启动的 iPhone 模拟器。先准备隔离的
`mock-user-a/b/c` 服务端数据，再运行 XCUITest：

```bash
pnpm mobile:ui:prepare
xcodebuild -workspace apps/mobile/ios/app.xcworkspace \
  -scheme app -configuration Debug \
  -destination 'id=<iPhone-simulator-UDID>' \
  -only-testing:appUITests/GangGangGoUITests test
```

Watch 工程使用 `apps/mobile/ios/app.xcworkspace` 中的 `app`、`XiaoTiduWatchApp` 和
`XiaoTiduWatchComplications` scheme。真实 Apple 登录、Push 和订阅需要 Apple Developer Program 配置。

移动端 development 可以使用 Mac 局域网地址；preview / production 构建必须通过 EAS 环境变量提供
HTTPS `EXPO_PUBLIC_API_BASE_URL`，缺失或指向 localhost 时构建会直接失败。

## 数据边界

菊花抬、蹲会儿、小账本和每日汇总采用本地优先存储。登录后，个人完整记录会同步到账号云端，包括训练次数、蹲会儿时长、排便细节和自定义小信号。好友默认看不到这些数据；用户需要按好友、按领域授予低敏或完整权限，服务端会在响应层裁剪未授权字段。健康事实和每日汇总保留 90 天，仍在使用的小信号常用项持续保留。

完整记录同步使用普通结构化字段，不做应用层端到端加密。好友读取直接基于云端每日汇总和关系权限，不再上传独立共享快照。生产环境需要每天调度一次过期数据清理：

```bash
pnpm build
pnpm --filter @xiaotidu/api data:purge-expired:prod
```

“我的”页面支持把云端账号数据复制为 JSON，并可永久删除云端账号。账号删除会清理云端关联数据和登录会话，但不会自动删除本机 SQLite 健康记录。

详细文档见 [docs/README.md](./docs/README.md) 和 [架构决策](./docs/architecture/README.md)。
