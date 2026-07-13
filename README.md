# 小提督 / GangGangGo

小提督是一个本地优先的健康习惯 App。仓库使用 pnpm workspace：

- `apps/mobile`：Expo + React Native、iOS Live Activity、Apple Watch。
- `apps/api`：Hono + Postgres + Drizzle API。
- `packages/contracts`：跨端 Zod schema 与 TypeScript 类型。

## Mac 开发环境

需要 Node.js 22+、pnpm 10+、Xcode 和 PostgreSQL。Android 构建额外需要 Android Studio / SDK 36 与 OpenJDK 17。首次安装：

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
cp apps/api/.env.example apps/api/.env
pnpm --filter @xiaotidu/api db:migrate
```

常用命令：

```bash
pnpm api:dev
pnpm mobile:ios
pnpm mobile:dev-client
pnpm check
```

Watch 工程使用 `apps/mobile/ios/app.xcworkspace` 中的 `app`、`XiaoTiduWatchApp` 和
`XiaoTiduWatchComplications` scheme。真实 Apple 登录、Push 和订阅需要 Apple Developer Program 配置。

## 数据边界

菊花抬、蹲会儿、小账本和基础报告保存在本地 SQLite，退出登录不会删除。云端只接收 Pro、小队和同步所需的低敏日级摘要；便血、不适、具体时长和排便感受不上传。

详细文档见 [docs/README.md](./docs/README.md) 和 [架构决策](./docs/architecture/README.md)。
