import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadOpenapiSpec(): Record<string, unknown> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const specPath = resolve(__dirname, 'openapi.json');
  return JSON.parse(readFileSync(specPath, 'utf-8'));
}
