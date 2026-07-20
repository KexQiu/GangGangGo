import { apiVersion } from '../config/version.js';
import { createApiApp } from './createApiApp.js';

export function createOpenApiDocument() {
  const app = createApiApp();
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    bearerFormat: 'JWT',
    scheme: 'bearer',
    type: 'http',
  });

  return app.getOpenAPI31Document({
    info: {
      title: '小提督 API',
      version: apiVersion,
    },
    openapi: '3.1.0',
    servers: [{ url: 'http://localhost:8787' }],
  });
}
