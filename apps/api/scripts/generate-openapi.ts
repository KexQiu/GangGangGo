import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createOpenApiDocument } from '../src/app/openapiDocument.js';

const httpMethods = ['delete', 'get', 'patch', 'post', 'put'] as const;
const document = createOpenApiDocument();
const operations = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
  httpMethods.flatMap((method) => {
    const operation = pathItem?.[method];
    if (!operation || typeof operation !== 'object') return [];
    return [{ method, path, summary: operation.summary ?? '未命名接口' }];
  }),
);
const openapi = `${JSON.stringify(document, null, 2)}\n`;
const markdown = `# 小提督 API 参考\n\n此文件由 \`pnpm --filter @xiaotidu/api docs:generate\` 生成。请求、响应和错误结构直接来自 \`@xiaotidu/contracts\`，接口登记来自 Hono OpenAPI 路由声明。\n\n## 认证\n\n登录返回 15 分钟 access token 和 30 天 refresh token。除登录、刷新、健康检查和邀请预览外，接口使用 \`Authorization: Bearer <accessToken>\`。\n\n## 接口\n\n${operations.map((item) => `- \`${item.method.toUpperCase()} ${item.path}\`：${item.summary}`).join('\n')}\n`;
const root = resolve(import.meta.dirname, '../../..');
const outputs = [
  [resolve(root, 'docs/v0.2/openapi.json'), openapi],
  [resolve(root, 'docs/v0.2/api-reference.md'), markdown],
] as const;

if (process.argv.includes('--check')) {
  const stale = outputs.filter(([path, content]) => readFileSync(path, 'utf8') !== content);
  if (stale.length > 0) {
    console.error(`Generated API documentation is stale: ${stale.map(([path]) => path).join(', ')}`);
    process.exitCode = 1;
  }
} else {
  for (const [path, content] of outputs) writeFileSync(path, content);
}
