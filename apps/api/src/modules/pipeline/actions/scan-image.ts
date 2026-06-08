import { db } from '../../../shared/database.js';
import { scanImage as scanImageUtil, type Severity } from '../../../shared/build/trivy.js';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`scan:image: params.${field} must be a non-empty string`);
  }
  return value;
}

function validateOptionalStringArray(value: unknown, field: string, defaultVal: string[]): string[] {
  if (value === undefined) return defaultVal;
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new Error(`scan:image: params.${field} must be an array of strings`);
  }
  return value;
}

function validateOptionalBoolean(value: unknown, field: string, defaultVal: boolean): boolean {
  if (value === undefined) return defaultVal;
  if (typeof value !== 'boolean') {
    throw new Error(`scan:image: params.${field} must be a boolean`);
  }
  return value;
}

function parseScanParams(raw: Record<string, unknown>): {
  image: string;
  severity: Severity[];
  exitCode: boolean;
} {
  const image = validateString(raw['image'], 'image');
  const severity = validateOptionalStringArray(raw['severity'], 'severity', ['CRITICAL', 'HIGH']) as Severity[];
  const exitCode = validateOptionalBoolean(raw['exitCode'], 'exitCode', true);

  return { image, severity, exitCode };
}

async function scanImageActionExecute(context: ActionContext): Promise<ActionResult> {
  const params = parseScanParams(context.stepParams);
  const { image, severity, exitCode } = params;

  context.logger.info(`Starting Trivy scan for ${image} with severity ${severity.join(',')}`);

  const start = Date.now();
  const scanResult = scanImageUtil(image, params.severity);
  const durationMs = Date.now() - start;

  const { total, bySeverity, vulnerabilities, passed, threshold } = scanResult;

  if (total > 0 && context.deploymentId) {
    const vulnRecords = vulnerabilities.map((v) => ({
      deploymentId: context.deploymentId,
      cveId: v.cveId,
      severity: v.severity,
      packageName: v.library,
      packageVersion: v.installedVersion,
      fixedVersion: v.fixedVersion ?? undefined,
      title: v.title,
      description: undefined,
      scanSource: 'trivy',
      rawReport: { library: v.library, status: v.status, title: v.title },
      detectedAt: new Date(),
    }));

    await db.deploymentVulnerability.createMany({ data: vulnRecords });
    context.logger.info(`Stored ${vulnRecords.length} vulnerabilities for deployment ${context.deploymentId}`);
  }

  const output = {
    scannedImage: image,
    vulnCount: total,
    criticalCount: bySeverity.CRITICAL,
    highCount: bySeverity.HIGH,
    mediumCount: bySeverity.MEDIUM,
    lowCount: bySeverity.LOW,
    durationMs,
    passed,
    threshold,
  };

  context.logger.info(`Scan complete: ${total} vulns (CRITICAL: ${bySeverity.CRITICAL}, HIGH: ${bySeverity.HIGH}), passed: ${passed}`);

  if (exitCode && !passed) {
    const msg = `scan:image: found ${total} vulnerabilities (CRITICAL: ${bySeverity.CRITICAL}, HIGH: ${bySeverity.HIGH}) exceeding threshold`;
    throw new Error(msg);
  }

  return {
    output,
    artifacts: [{ name: 'scan-results', url: `trivy://${image}` }],
  };
}

export const scanImageAction: PipelineAction = {
  name: 'scan:image',
  validate(raw: Record<string, unknown>) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('scan:image: params must be an object');
    }
    validateString(raw['image'], 'image');
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    return scanImageActionExecute(context);
  },
};