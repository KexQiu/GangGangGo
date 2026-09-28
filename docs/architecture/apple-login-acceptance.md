# R01 Apple 登录实施与验收

日期：2026-09-28；基于 `43fbbe0`。本批接入真实授权的代码与配置，尚未完成签名设备或真实 Apple 服务联调，R01 保持待验收。

## 实现范围

- “我的”和邀请加入页先展示 `LoginSyncSheet` 同步说明，再由官方原生 Apple 按钮发起授权。仅请求姓名；Apple 未再次提供姓名时保留已有昵称。
- `appleSignInFlow` 在系统授权完成前不改变本地会话。取消、缺失 token、state 不匹配、说明页关闭、账号代次改变均不提交登录；共享入口拦截并发授权。
- 授权成功后才将 identity token 与本次随机 nonce 交给现有 auth store；提交登录期间禁用取消，避免误示可以撤销已经开始的资料绑定。API 验证失败不绑定本地资料。登录结果绑定会话代次，旧登录完成不能上报新账号登录成功。
- 服务端限制 RS256，验证 Apple issuer、bundle audience、必需的 sub/exp/iat/nonce 和 nonce 一致性。开发 Mock API 拒绝真实 JWT/nonce，避免静默创建模拟身份。请求契约移除未使用的 authorizationCode。
- 开发登录要求开发 JS 构建、development 运行环境（未指定时默认为 development）和 `EXPO_PUBLIC_ENABLE_MOCK_LOGIN=1` 同时满足，UI 与 store 均受限。preview/production 即使误设该开关也不可用。
- 已添加 Expo SDK 54 对应的 `expo-apple-authentication ~8.0.8`、`expo-crypto ~15.0.9`，以及 Expo 插件、`ios.usesAppleSignIn`、原生 entitlement 与按钮本地化配置。Android/不支持的设备保留本地记录入口，不自动使用模拟账号。

state 在客户端匹配；nonce 按该 SDK 的原生实现直接传入 Apple，服务端核对相同原值。当前没有服务端一次性 challenge 消费机制，不能将 nonce 匹配描述为完整请求的防重放保证。客户端不记录身份令牌或授权响应。

实现依据：[Expo SDK 54 AppleAuthentication 文档](https://docs.expo.dev/versions/v54.0.0/sdk/apple-authentication/)、[对应 SDK 的原生请求实现](https://github.com/expo/expo/blob/sdk-54/packages/expo-apple-authentication/ios/AppleAuthenticationRequest.swift)。本地已核对实际安装的 8.0.8 源码。

## 自动化回归

本次执行结果：

| 命令/检查 | 结果 |
| --- | --- |
| `pnpm --filter @xiaotidu/mobile test --maxWorkers=2 --no-file-parallelism` | 29 文件、198 项通过；含本轮登录回归 |
| `pnpm --filter @xiaotidu/api exec vitest run --maxWorkers=2 --no-file-parallelism` | 71 项通过；13 项 PostgreSQL 集成测试因未设置 `DATABASE_URL` 跳过 |
| `pnpm --filter @xiaotidu/contracts test` | 6 文件、50 项通过 |
| `pnpm build`、`pnpm typecheck` | 通过；最终说明页修改后另跑 mobile typecheck 通过 |
| `pnpm docs:check` | 通过；已重新生成 OpenAPI 并更新、核对快照 |
| `pnpm versions:check`、本批代码 Prettier、`git diff --check` | 通过 |
| `pnpm lint` | 通过 |
| `EXPO_OFFLINE=1 EXPO_NO_DOTENV=1 pnpm --filter @xiaotidu/mobile bundle:check` | iOS JS/Hermes 导出通过 |
| `EXPO_OFFLINE=1 EXPO_NO_DOTENV=1 pnpm --filter @xiaotidu/mobile bundle:check:android` | Android JS/Hermes 导出通过 |
| `EXPO_OFFLINE=1 EXPO_NO_DOTENV=1 pnpm --filter @xiaotidu/mobile exec expo install --check` | 本地 SDK 版本匹配通过；CLI 提示离线校验有局限，未做联网版本校验 |
| Expo public config、`plutil -lint` | bundle ID、Apple 插件与能力开关正确；Info.plist/entitlements 语法通过 |

测试重点：

- `appleSignInFlow.test.ts`：取消后重试、无效响应、重复点击、页面关闭/换号、平台不可用、API 拒绝和原生异常。
- `authStore.test.ts`：nonce 透传、关闭 Mock 的直接调用保护、API 拒绝不绑定资料及既有会话竞态。
- `appleAuthService.test.ts`：本地 RSA/JWKS 的真实密码学验签，错误签名、issuer、audience、过期/缺失声明及 nonce 不匹配；经 Hono 路由首次登录、退出、再次登录保留身份与昵称。
- 契约、OpenAPI、全仓类型/lint 和 iOS/Android JS 导出。

服务端测试使用本地生成的签名密钥和内存用户/会话仓储，不连接 Apple JWKS、Apple 账号或真实 PostgreSQL，不等同于 Apple 端到端验收。

## 原生与环境前置条件

1. 在 Apple Developer 中为 `com.kex.xiaotidu` 配置 Sign in with Apple，生成包含对应能力的 provisioning profile。
2. 在具备完整 Xcode 的 Mac 安装 Pods 并重新构建开发客户端/签名包：在 `apps/mobile/ios` 执行 `pod install`，再按已有 scheme 构建。新增原生模块不能只靠 JS 热更新生效。
3. 隔离 API 配置 `APPLE_AUTH_MODE=real`、`APPLE_BUNDLE_ID=com.kex.xiaotidu`，使用默认 Apple JWKS 地址。Preview 配置 HTTPS API、独立 PostgreSQL 和会话密钥，完成迁移；不要使用生产用户资料。
4. 签名包使用 preview/production 的运行环境，关闭 Mock；开发模拟联调则仅在 development 显式打开移动端开关并连接 Mock API。

本机仅安装 Command Line Tools，尚未运行 Xcode scheme、Pods 更新或签名设备测试。开始本批前已有 `apps/mobile/ios/Podfile.lock` 修改，本批原样保留，不覆盖或纳入上一批提交。CI 已有 macOS `pod install` 和 scheme 构建步骤，尚未获取本批远端运行结果。

## 待完成设备验收

| 场景 | 验收要求 | 状态 |
| --- | --- | --- |
| 首次授权 | 从“我的”阅读说明，点击原生 Apple 按钮；真实 API 登录后资料归属与同步正确 | 待验收 |
| 取消 | 关闭同步说明、取消系统授权均不创建会话，不合并匿名资料；可再次登录 | 待验收 |
| 失效/错误 | 真实拒绝、过期 token、网络失败有错误反馈，无错误绑定；重试可恢复 | 待验收 |
| 重登 | 退出后重新登录仍是同一账号；Apple 未返回姓名时保留昵称 | 待验收 |
| 邀请加入 | 未登录打开邀请，阅读说明并真实授权，返回原邀请完成加入 | 待验收 |
| 双账号/双设备 | 本地资料、同步请求和云端缓存归属正确；旧授权迟到不能换回旧账号 | 待验收 |
| 交互/平台 | 小屏、大字体、深色、VoiceOver；操作始终可见，系统授权前后取消规则正确；不支持平台显示说明 | 待验收 |
| 正式边界 | preview/production 无开发账号区，误设 Mock 开关仍不可调用；正式 API 不接受 Mock token | 待验收 |

记录所用提交、API/包环境、iOS/机型、操作与结果后，再更新[真机验收总清单](./physical-device-acceptance-checklist.md)。R01 的设备验收不由本地 JWT 测试或 Expo bundle 成功代替。
