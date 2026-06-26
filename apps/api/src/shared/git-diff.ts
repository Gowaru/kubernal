export interface DeploymentLike {
  id: string;
  version: string;
  commitSha: string;
  status: string;
  trigger: string;
  approvedById: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  environmentId: string;
  environmentType?: string;
  violations?: unknown[];
}

export interface FieldChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export interface DeploymentDiff {
  from: DeploymentLike;
  to: DeploymentLike;
  changes: FieldChange[];
  durationDelta: number | null;
  statusTransition: string;
  isPromotion: boolean;
  summary: string;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function diffField(
  changes: FieldChange[],
  field: string,
  fromVal: unknown,
  toVal: unknown,
): void {
  const a = asString(fromVal);
  const b = asString(toVal);
  if (a !== b) {
    changes.push({ field, from: a, to: b });
  }
}

export function summarizeDiff(from: DeploymentLike, to: DeploymentLike): DeploymentDiff {
  const changes: FieldChange[] = [];
  diffField(changes, 'version', from.version, to.version);
  diffField(changes, 'commitSha', from.commitSha, to.commitSha);
  diffField(changes, 'status', from.status, to.status);
  diffField(changes, 'trigger', from.trigger, to.trigger);
  diffField(changes, 'approvedById', from.approvedById, to.approvedById);
  diffField(changes, 'environmentType', from.environmentType, to.environmentType);

  const fromFinish = asNumber(from.finishedAt);
  const toFinish = asNumber(to.finishedAt);
  const fromStart = asNumber(from.startedAt);
  const toStart = asNumber(to.startedAt);
  let durationDelta: number | null = null;
  if (fromFinish !== null && toFinish !== null && fromStart !== null && toStart !== null) {
    durationDelta = toFinish - toStart - (fromFinish - fromStart);
  }

  const statusTransition = `${from.status} → ${to.status}`;
  const isPromotion = from.environmentType !== to.environmentType;

  let summary: string;
  if (changes.length === 0 && durationDelta === 0) {
    summary = 'Aucun changement';
  } else {
    const parts: string[] = [];
    if (changes.find((c) => c.field === 'version')) parts.push(`version ${from.version} → ${to.version}`);
    if (changes.find((c) => c.field === 'commitSha')) parts.push(`commit ${from.commitSha.slice(0, 7)} → ${to.commitSha.slice(0, 7)}`);
    if (changes.find((c) => c.field === 'status')) parts.push(`statut ${from.status} → ${to.status}`);
    if (isPromotion) parts.push(`promotion ${from.environmentType} → ${to.environmentType}`);
    if (durationDelta !== null && durationDelta !== 0) {
      const sign = durationDelta > 0 ? '+' : '';
      parts.push(`durée ${sign}${Math.round(durationDelta / 1000)}s`);
    }
    summary = parts.join(' · ');
  }

  return {
    from,
    to,
    changes,
    durationDelta,
    statusTransition,
    isPromotion,
    summary,
  };
}
