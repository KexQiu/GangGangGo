# 会话归属回归记录

日期：2026-09-28。实现基于 `865146d` 后的工作区，范围为审查项 R02、R03、R10。此记录覆盖 JavaScript 业务逻辑与 SQLite 故障注入，不替代真机验收。

## 实现范围

- `SessionContext` 将 generation、用户、profile 和 token 绑定；退出、登录、恢复立即让旧代次失效，普通 token 轮换保持代次。
- auth store 与 HTTP 刷新按代次合并请求，旧请求的完成、失败及清理回调不能修改新的会话。
- HTTP 首次发送、网络重试、401 刷新等待及响应解析均校验归属；已退出会话的远端撤销独立于当前身份。
- SecureStore 保存完整会话归属；离线恢复先校验 SQLite profile 与用户一致。网络/超时/5xx/无效响应保留凭证，明确的凭证失效才登出。
- profile 切换与本地持久化共用副作用队列；完整同步全程显式使用原 profile。三类健康列表取消过期的加载结果。

## 自动化覆盖

| 测试文件 | 覆盖 |
| --- | --- |
| `apps/mobile/src/features/account/__tests__/authStore.test.ts` | 刷新后退出、A 刷新后登录 B、延迟登录/恢复、SecureStore 写入与退出交错、新旧刷新清理、暂时失败保留会话并重试、明确失效登出、账号不匹配、离线恢复、远端退出未返回 |
| `apps/mobile/src/api/__tests__/transport.test.ts` | GET/PUT 网络重试、POST 不自动重试、取消/超时、响应校验、同代次 401 刷新合并 |
| `apps/mobile/src/api/__tests__/sessionTransport.test.ts` | 换号后的成功/401/500、退避期间换号、刷新等待期间换号、失败分类、正常轮换、旧 token、异步读取响应体、过期重试回包、独立退出与无效 401 |
| `apps/mobile/src/features/sync/__tests__/sessionDataSync.test.ts` | A→B 和 B→A outbox 读取交错、在途 push/pull、正常令牌轮换、身份切换期间暂停、落库与切换排序、匿名记录绑定回滚、恢复资料归属不匹配 |
| `apps/mobile/src/features/account/__tests__/sessionStorage.test.ts` | 凭证与归属同值保存、格式校验、Keychain 错误不冒充无会话 |
| `apps/mobile/src/features/account/__tests__/profileHydration.test.ts` | 训练、如厕和习惯列表忽略旧 profile 的延迟成功与失败 |

SQLite 测试使用 Node `DatabaseSync(':memory:')` 执行真实迁移和 SQL，通过 Expo SQLite 适配器接口控制异步交错；auth store 测试对网络、Keychain 和原生依赖做受控替换，HTTP 测试使用可控 fetch。未连接真实 API，也未访问用户数据库或 Keychain。

## 本轮验证结果

| 检查 | 结果 |
| --- | --- |
| 移动端测试 | 20 个文件、111 项全部通过；相对基线新增 51 项。导入顺序修正后，受影响的 4 个文件、38 项再次通过 |
| 移动端 TypeScript | 通过 |
| 全仓 lint | 无错误；新增测试的 6 处导入顺序警告已修正，4 个受影响文件以 `--max-warnings 0` 定向复验通过 |
| 全仓格式检查 | 通过 |
| 文档/API 契约检查 | 通过 |
| iOS / Android Expo 导出 | 均通过；不代表原生安装或真机验收 |
| `git diff --check` | 通过 |

## 复验命令

```sh
pnpm --filter @xiaotidu/mobile test
pnpm --filter @xiaotidu/mobile typecheck
pnpm lint
pnpm format:check
pnpm docs:check
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 CI=1 pnpm --filter @xiaotidu/mobile bundle:check
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 CI=1 pnpm --filter @xiaotidu/mobile bundle:check:android
```

## 待真机验收与后续边界

- iPhone 登录 A，断网启动，确认保留 A 的资料；网络恢复后续期并完成同步。
- 两个测试账号反复切换，在刷新和同步回包期间退出或换号，检查各自云端记录、列表及重启恢复。
- Keychain 临时不可用、实际 iOS/Android 网络取消和应用强制退出需要设备验证。此次导出检查仅验证 JavaScript 打包。
- 上线前直接采用新的 SecureStore 格式，旧开发会话需重新登录，不做兼容迁移。
- R04 Watch 事件归属、R05 推送解绑与离线补偿、R08 保存结果、R09 本地编辑冲突、R21 服务端游标提交顺序未纳入本批关闭范围。
