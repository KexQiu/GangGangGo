# Architecture v2 后续待办

更新日期：2026-08-06
当前基线：Hono + Drizzle 模块化 API、Expo 本地优先移动端、Watch schema v3

本文只记录当前仍有效的架构与上线待办。旧版“小队 / nudges / sharing”实现记录已由现行“好友 / friend events / data sync”模型替代，不再作为当前目录或接口事实源。

## 状态和优先级

- `P0`：当前分支合并前必须完成。
- `P1`：结构、质量与自动化门禁。
- `P2`：公开测试或生产上线前完成。
- `P3`：明确延期，重新排期后实施。

## P0：当前分支

- [x] 修复 Watch v3 fixture 与 Swift 校验版本漂移。
- [x] 修复 Prettier 与 ESLint 门禁问题。
- [x] preview/production 移动端构建强制 HTTPS API 地址，禁止 localhost。
- [x] 保持真实 Sign in with Apple 待定，不用 Mock 冒充生产能力。

## P1：代码结构

### 移动端

- [x] Expo Router 文件只负责导航与 feature screen 挂载。
- [x] 云端状态由 TanStack Query 持有；Zustand 只保存会话、本地领域状态和短期 UI 状态。
- [x] API client 按 auth、users、dataSync、friends、growth、push、reports、subscriptions 拆分。
- [x] 拆分 `ToiletRecordForm.tsx`：
  - 表单编排：`ToiletRecordForm.tsx`
  - 字段和时长滚轮：`components/ToiletRecordFormFields.tsx`
  - 常量：`toiletRecordForm.constants.ts`
  - 样式：`styles/toiletRecordFormStyles.ts`

### API

- [x] 保持 `server.ts -> app.ts/createApiApp -> registerRoutes` 稳定装配链。
- [x] contracts 作为请求、响应、移动端解析和 OpenAPI 的单一来源。
- [x] 好友域拆为 Drizzle service、policy、mapper、mock 和 types。
- [x] 报告域保持 service/repository/mapper/mock 分层。
- [x] 账号数据生命周期独立为 `accountDataService.ts`。
- [x] 定时保留策略独立为 `storage/retentionService.ts`，删除请求链路内的顺带清理。
- [x] API scripts 纳入 TypeScript 类型检查。

## P1：安全与数据生命周期

- [x] 全局 request id、结构化请求日志和统一错误响应。
- [x] 安全响应头。
- [x] 默认 256 KiB 请求体限制与结构化 413。
- [x] 可配置的单进程固定窗口限流与结构化 429。
- [x] `GET /me/export` 账号数据导出。
- [x] `DELETE /me` 云端账号永久删除。
- [x] 移动端导出、删除确认和本地会话清理入口。
- [x] 90 天健康/增长数据、过期 session、邀请、临时好友事件和旧每日计数的统一清理任务。
- [x] 账号导出/删除和保留策略文档。

## P1：构建与自动化

- [x] contracts 编译为 ESM。
- [x] API 编译到 `apps/api/dist`，生产入口为 `node dist/server.js`。
- [x] 根目录固定 pnpm 10.32，Node 类型与 CI 对齐到 22。
- [x] 根门禁包含生产构建、类型、lint、格式、测试、OpenAPI 和 iOS/Android Expo bundle。
- [x] CI 使用 PostgreSQL 17 应用迁移并运行真实 Drizzle 集成测试。
- [x] 集成测试覆盖认证、用户/权益、报告、好友/同步、账号删除和保留策略。
- [x] Apple CI 构建 iPhone、Watch App、Watch complication，并校验 Watch v3 fixture。

## P2：人工验收

真机证据统一记录在[真机验收总清单](./physical-device-acceptance-checklist.md)。

- [ ] 完成 Watch 离线恢复、重复事件、haptic、Complication 和系统刷新节奏验收。
- [ ] 在可签名 iPhone 真机验证 Live Activity 启动、更新、结束和重启恢复。
- [ ] 完成生产双用户、好友权限、账号导出/删除与本地数据保留回归。
- [ ] 验证 preview/production 的真实 HTTPS API、证书和错误展示。

## P2：生产环境与合规

- [ ] 部署生产 API 与 PostgreSQL，配置独立 secrets、连接池和迁移发布流程。
- [ ] 在网关或共享存储层实现多实例一致限流。
- [ ] 建立指标、告警、备份恢复、回滚和故障手册。
- [ ] 定义审计事件最终法定保留期限和备份擦除流程。
- [ ] 将账号导出、删除、健康数据和非医疗用途边界同步到用户可见隐私政策。
- [ ] 建立密钥轮换和最小权限访问流程。

## P2：Apple 能力与商业化

- [ ] 接入真实 Sign in with Apple，并完成 Apple Developer capability。
- [ ] 接入远程 Push 生产证书、发送、失败重试和回执。
- [ ] 接入真实 StoreKit 购买、恢复购买和取消后的权益生命周期。
- [ ] 接入 App Store Server API 与 Server Notifications。
- [ ] 完成 Live Activity 真机签名和发布配置。
- [ ] 完成 Paywall、邀请分享和 onboarding 产品验收。

## P3：延期范围

- [ ] Android 完整适配与商店发布。
- [ ] 社区功能。
- [ ] 自由聊天。
- [ ] AI 功能。
- [ ] 当前 v0.2 范围之外的新健康领域和 UI 重设计。

## 推荐执行顺序

1. 完成当前代码全量 `pnpm check`、Expo dependency check 和 Apple scheme 回归。
2. 获取 Apple Developer 权限后补真实 Apple 登录、Push 与真机签名验收。
3. 部署生产 API/PostgreSQL，并补多实例限流、监控、备份与恢复。
4. 完成隐私政策、审计期限和 App Store 发布材料。
