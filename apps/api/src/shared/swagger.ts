import spec from './openapi.json' with { type: 'json' };

export function loadOpenapiSpec(): Record<string, unknown> {
  return spec as Record<string, unknown>;
}
