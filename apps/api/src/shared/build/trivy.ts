import { execSync } from 'node:child_process';
import { logger } from '../logger.js';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export const DEFAULT_SEVERITY_THRESHOLD: Severity[] = ['CRITICAL'];

export interface TrivyVulnerability {
  library: string;
  cveId: string;
  severity: Severity;
  status: 'fixed' | 'affected' | 'not-affected' | string;
  installedVersion: string;
  fixedVersion: string | null;
  title: string;
}

export interface TrivyScanResult {
  imageRef: string;
  scanner: 'trivy-cli' | 'trivy-docker' | 'none';
  scannedAt: string;
  total: number;
  bySeverity: Record<Severity, number>;
  vulnerabilities: TrivyVulnerability[];
  passed: boolean;
  threshold: Severity[];
  durationMs: number;
  error?: string;
}

const TRIVY_DOCKER_IMAGE = 'aquasec/trivy:latest';

function detectTrivyCommand(): 'trivy-cli' | 'trivy-docker' | 'none' {
  try {
    execSync('command -v trivy', { stdio: 'pipe' });
    return 'trivy-cli';
  } catch {
    try {
      execSync('command -v docker', { stdio: 'pipe' });
      return 'trivy-docker';
    } catch {
      return 'none';
    }
  }
}

function runTrivyCommand(imageRef: string, severity: Severity[]): string {
  const sevArgs = severity.join(',');
  const scanner = detectTrivyCommand();
  if (scanner === 'trivy-cli') {
    return execSync(
      `trivy image --format json --quiet --severity ${sevArgs} --no-progress "${imageRef}"`,
      { encoding: 'utf8', stdio: 'pipe' },
    );
  }
  if (scanner === 'trivy-docker') {
    return execSync(
      `docker run --rm -v /tmp/.trivy-cache:/root/.cache/trivy ${TRIVY_DOCKER_IMAGE} image --format json --quiet --severity ${sevArgs} --no-progress "${imageRef}"`,
      { encoding: 'utf8', stdio: 'pipe' },
    );
  }
  throw new Error('Neither trivy CLI nor Docker is available. Install trivy or Docker.');
}

export function scanImage(
  imageRef: string,
  threshold: Severity[] = DEFAULT_SEVERITY_THRESHOLD,
): TrivyScanResult {
  const start = Date.now();
  const scanner = detectTrivyCommand();
  const scannedAt = new Date().toISOString();

  if (scanner === 'none') {
    return {
      imageRef,
      scanner: 'none',
      scannedAt,
      total: 0,
      bySeverity: emptyBySeverity(),
      vulnerabilities: [],
      passed: false,
      threshold,
      durationMs: 0,
      error: 'No scanner available (install trivy CLI or Docker)',
    };
  }

  try {
    const raw = runTrivyCommand(imageRef, threshold);
    const parsed = JSON.parse(raw) as TrivyReportJson;
    const vulns = parseVulnerabilities(parsed);
    const bySeverity = countBySeverity(vulns);
    const passed = threshold.every((s) => bySeverity[s] === 0);

    return {
      imageRef,
      scanner,
      scannedAt,
      total: vulns.length,
      bySeverity,
      vulnerabilities: vulns,
      passed,
      threshold,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ imageRef, error: message }, 'Trivy scan failed');
    return {
      imageRef,
      scanner,
      scannedAt,
      total: 0,
      bySeverity: emptyBySeverity(),
      vulnerabilities: [],
      passed: false,
      threshold,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

function emptyBySeverity(): Record<Severity, number> {
  return { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
}

interface TrivyReportJson {
  Results?: Array<{
    Target?: string;
    Class?: string;
    Type?: string;
    Vulnerabilities?: Array<{
      PkgName?: string;
      VulnerabilityID?: string;
      Severity?: string;
      Status?: string;
      InstalledVersion?: string;
      FixedVersion?: string;
      Title?: string;
    }>;
  }>;
}

function parseVulnerabilities(report: TrivyReportJson): TrivyVulnerability[] {
  const vulns: TrivyVulnerability[] = [];
  for (const result of report.Results ?? []) {
    for (const v of result.Vulnerabilities ?? []) {
      vulns.push({
        library: v.PkgName ?? 'unknown',
        cveId: v.VulnerabilityID ?? 'unknown',
        severity: (v.Severity as Severity) ?? 'UNKNOWN',
        status: v.Status ?? 'unknown',
        installedVersion: v.InstalledVersion ?? 'unknown',
        fixedVersion: v.FixedVersion ?? null,
        title: v.Title ?? '',
      });
    }
  }
  return vulns;
}

function countBySeverity(vulns: TrivyVulnerability[]): Record<Severity, number> {
  const counts = emptyBySeverity();
  for (const v of vulns) {
    counts[v.severity] = (counts[v.severity] ?? 0) + 1;
  }
  return counts;
}
