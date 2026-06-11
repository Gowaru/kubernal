import semver from 'semver';

export type BumpType = 'auto' | 'major' | 'minor' | 'patch';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

export function isValidSemver(value: string): boolean {
  return SEMVER_RE.test(value);
}

export function stripBuildMetadata(version: string): string {
  return version.split('+')[0] ?? version;
}

export function stripPrerelease(version: string): string {
  return version.split('-')[0] ?? version;
}

function bumpStrictSemver(current: string, bump: 'major' | 'minor' | 'patch'): string {
  const base = stripBuildMetadata(current);
  const core = stripPrerelease(base);
  if (!semver.valid(core)) {
    throw new Error(`Not a valid semver version: ${current}`);
  }
  return semver.inc(core, bump) ?? core;
}

function shortSha(sha: string | undefined): string | null {
  if (!sha) return null;
  return sha.replace(/[^0-9a-f]/gi, '').slice(0, 7).toLowerCase();
}

function prereleaseForBranch(branch: string | undefined): string | null {
  if (!branch) return null;
  const cleaned = branch.replace(/^refs\/heads\//, '').replace(/[^0-9a-zA-Z-]/g, '-');
  if (cleaned === 'main' || cleaned === 'master' || cleaned === 'production') return null;
  return cleaned;
}

function buildMetadata(opts: { commitSha?: string; branch?: string }): string | null {
  const parts: string[] = [];
  const sha = shortSha(opts.commitSha);
  if (sha) parts.push(`sha.${sha}`);
  if (opts.branch) parts.push(`branch.${opts.branch.replace(/[^0-9a-zA-Z-]/g, '-')}`);
  return parts.length > 0 ? parts.join('.') : null;
}

export interface NextVersionInput {
  bump: BumpType;
  currentVersion?: string;
  commitSha?: string;
  branch?: string;
}

export interface NextVersionOutput {
  bump: BumpType;
  currentVersion: string | null;
  version: string;
  display: string;
  isPrerelease: boolean;
}

export function nextVersion(input: NextVersionInput): NextVersionOutput {
  const hasCurrent = input.currentVersion && isValidSemver(input.currentVersion);
  const baseCurrent = hasCurrent ? stripBuildMetadata(input.currentVersion!) : '0.1.0';

  let bumpedCore: string;
  if (input.bump === 'auto') {
    bumpedCore = hasCurrent ? bumpStrictSemver(baseCurrent, 'patch') : '0.1.0';
  } else {
    bumpedCore = hasCurrent ? bumpStrictSemver(baseCurrent, input.bump) : '0.1.0';
  }

  const prerelease = input.bump === 'auto' ? prereleaseForBranch(input.branch) : null;
  const finalCore = prerelease ? `${bumpedCore}-${prerelease}` : bumpedCore;

  const meta = buildMetadata({ commitSha: input.commitSha, branch: input.branch });
  const version = meta ? `${finalCore}+${meta}` : finalCore;

  return {
    bump: input.bump,
    currentVersion: input.currentVersion ?? null,
    version,
    display: version,
    isPrerelease: !!prerelease,
  };
}

export function isPrerelease(version: string): boolean {
  const base = stripBuildMetadata(version);
  const prerelease = base.split('-')[1];
  return !!prerelease && prerelease.length > 0;
}

export function compareVersions(a: string, b: string): number {
  const va = semver.valid(semver.coerce(stripBuildMetadata(a)) ?? '');
  const vb = semver.valid(semver.coerce(stripBuildMetadata(b)) ?? '');
  if (!va || !vb) return 0;
  return semver.compare(va, vb);
}
