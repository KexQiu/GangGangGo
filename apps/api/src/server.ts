import { createServer, type ServerResponse } from 'node:http';

import { type ApiHealthResponse, type EntitlementsResponse } from '@xiaotidu/contracts';

const port = Number(process.env.PORT ?? 8787);

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    const body: ApiHealthResponse = {
      ok: true,
      service: 'xiaotidu-api',
      version: '0.2.0',
    };
    sendJson(response, 200, body);
    return;
  }

  if (request.method === 'GET' && request.url === '/me/entitlements') {
    const body: EntitlementsResponse = {
      proStatus: 'free',
    };
    sendJson(response, 200, body);
    return;
  }

  sendJson(response, 404, {
    error: 'not_found',
  });
});

server.listen(port, () => {
  console.log(`xiaotidu api listening on http://localhost:${port}`);
});
