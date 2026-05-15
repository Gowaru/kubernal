import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadOpenapiSpec(): Record<string, unknown> {
  const specPath = resolve("src/shared/openapi.json");
  return JSON.parse(readFileSync(specPath, "utf-8"));
}
