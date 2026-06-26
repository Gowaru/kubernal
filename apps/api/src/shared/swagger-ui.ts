import swaggerUi from 'swagger-ui-express';
import { loadOpenapiSpec } from './swagger.js';
import type { Router } from 'express';

const spec = loadOpenapiSpec();

export function mountSwaggerUi(router: Router): void {
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      explorer: true,
      customSiteTitle: 'Kubernal IDP API',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );

  router.get('/docs.json', (_req, res) => {
    res.json(spec);
  });
}
