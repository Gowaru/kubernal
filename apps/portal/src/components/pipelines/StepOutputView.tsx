import { type JSX, type ReactNode } from 'react';
import {
  Container,
  Shield,
  FileCode,
  GitBranch,
  Server,
  Boxes,
  Terminal,
  Clock,
  CheckCheck,
  HardDrive,
  Hash,
  Tag,
  Layers,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  ExternalLink,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type OutputValue = string | number | boolean | null | undefined | OutputValue[] | { [k: string]: OutputValue };

export interface ArtifactLike {
  name: string;
  url: string;
}

interface OutputViewProps {
  action: string;
  output: Record<string, OutputValue> | null;
  artifacts?: ArtifactLike[];
}

interface FieldProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'error' | 'info';
  mono?: boolean;
  truncate?: boolean;
  copyable?: string;
}

const TONE_CLASSES: Record<NonNullable<FieldProps['tone']>, string> = {
  default: 'text-foreground/90',
  muted: 'text-muted-foreground',
  success: 'text-status-success',
  warning: 'text-status-warning',
  error: 'text-status-error',
  info: 'text-status-info',
};

function Field({ icon: Icon, label, value, tone = 'default', mono = false, truncate = false, copyable }: FieldProps): JSX.Element {
  const IconEl = (
    <Icon className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
  );
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      {IconEl}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
          {label}
        </span>
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              'text-xs leading-snug',
              mono && 'font-mono',
              truncate && 'truncate',
              TONE_CLASSES[tone],
            )}
            title={typeof value === 'string' ? value : undefined}
          >
            {value}
          </span>
          {copyable && (
            <CopyButton text={copyable} />
          )}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
      }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      title="Copier"
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

function formatDuration(ms: number | undefined | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `<1s`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function shortHash(input: string | undefined | null): string {
  if (!input) return '—';
  return input.length > 16 ? input.slice(0, 16) : input;
}

function SeverityBadge({ label, count, icon: Icon }: { label: string; count: number; icon: LucideIcon }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1">
      <Icon
        className={cn(
          'h-3 w-3',
          count > 0 ? 'text-status-error' : 'text-status-success',
        )}
      />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-xs font-semibold font-mono',
          count > 0 ? 'text-status-error' : 'text-status-success',
        )}
      >
        {count}
      </span>
    </div>
  );
}

function K8sKindIcon({ kind }: { kind: string }): JSX.Element {
  const k = kind.toLowerCase();
  const iconMap: Record<string, LucideIcon> = {
    deployment: Boxes,
    service: Layers,
    configmap: FileCode,
    secret: Shield,
    namespace: Folder,
    pod: Container,
    statefulset: Boxes,
    daemonset: Boxes,
    job: Terminal,
    cronjob: Clock,
  };
  const Icon = iconMap[k] ?? FileCode;
  return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
}

function JsonRawToggle({ output }: { output: Record<string, OutputValue> | null }): JSX.Element {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[10px] font-semibold uppercase tracking-wide select-none mt-2">
        JSON brut
      </summary>
      <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 border border-border px-3 py-2 text-[10px] font-mono leading-relaxed text-muted-foreground max-h-48">
        {JSON.stringify(output, null, 2)}
      </pre>
    </details>
  );
}

function BuildOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field
          icon={Container}
          label="Image"
          value={String(output['image'] ?? '—')}
          mono
          truncate
        />
        <Field
          icon={Hash}
          label="Image ID"
          value={shortHash(output['imageId'] as string)}
          mono
          tone="muted"
        />
        <Field
          icon={Tag}
          label="Platform"
          value={String(output['platform'] ?? '—')}
          mono
          tone="muted"
        />
        <Field
          icon={Clock}
          label="Duration"
          value={formatDuration(output['durationMs'] as number)}
          mono
          tone="success"
        />
      </div>
      {output['labels'] && typeof output['labels'] === 'object' && Object.keys(output['labels'] as object).length > 0 && (
        <div className="flex items-start gap-1.5">
          <Tag className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Labels</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(output['labels'] as Record<string, string>).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono">
                  {k}={String(v)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <JsonRawToggle output={output} />
    </div>
  );
}

function PushOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field
          icon={Container}
          label="Image"
          value={String(output['image'] ?? '—')}
          mono
          truncate
        />
        <Field
          icon={Server}
          label="Registry"
          value={String(output['registry'] ?? '—')}
          mono
          tone="info"
        />
        <Field
          icon={Hash}
          label="Image ID"
          value={shortHash(output['imageId'] as string)}
          mono
          tone="muted"
        />
        <Field
          icon={Clock}
          label="Duration"
          value={formatDuration(output['durationMs'] as number)}
          mono
          tone="success"
        />
      </div>
      <JsonRawToggle output={output} />
    </div>
  );
}

function ScanOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  const vulnCount = Number(output['vulnCount'] ?? 0);
  const critical = Number(output['criticalCount'] ?? 0);
  const high = Number(output['highCount'] ?? 0);
  const medium = Number(output['mediumCount'] ?? 0);
  const low = Number(output['lowCount'] ?? 0);
  const threshold = Array.isArray(output['threshold']) ? (output['threshold'] as string[]).join('+') : '—';
  const passed = Boolean(output['passed']);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field
          icon={Container}
          label="Image"
          value={String(output['scannedImage'] ?? output['image'] ?? '—')}
          mono
          truncate
        />
        <Field
          icon={Shield}
          label="Threshold"
          value={threshold}
          tone="muted"
        />
        <Field
          icon={Clock}
          label="Duration"
          value={formatDuration(output['durationMs'] as number)}
          mono
          tone="success"
        />
        <Field
          icon={CheckCheck}
          label="Verdict"
          value={passed ? 'Passed' : 'Failed'}
          tone={passed ? 'success' : 'error'}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <SeverityBadge label="Critical" count={critical} icon={ShieldAlert} />
        <SeverityBadge label="High" count={high} icon={AlertTriangle} />
        <SeverityBadge label="Medium" count={medium} icon={AlertCircle} />
        <SeverityBadge label="Low" count={low} icon={Info} />
      </div>
      {vulnCount > 0 && (
        <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-status-error" />
          <span className="text-xs text-status-error font-medium">
            {vulnCount} vulnérabilité{vulnCount > 1 ? 's' : ''} détectée{vulnCount > 1 ? 's' : ''}
            {critical > 0 ? ` (${critical} critique${critical > 1 ? 's' : ''})` : high > 0 ? ` (${high} haute${high > 1 ? 's' : ''})` : ''}
          </span>
        </div>
      )}
      <JsonRawToggle output={output} />
    </div>
  );
}

function DeployOutputView({ output, artifacts }: { output: Record<string, OutputValue>; artifacts?: ArtifactLike[] }): JSX.Element {
  const applied = Array.isArray(output['appliedResources']) ? (output['appliedResources'] as string[]) : [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field
          icon={Server}
          label="Namespace"
          value={String(output['namespace'] ?? '—')}
          mono
          truncate
        />
        <Field
          icon={CheckCheck}
          label="Rollout"
          value={String(output['rolloutStatus'] ?? '—')}
          tone={String(output['rolloutStatus']) === 'complete' ? 'success' : 'default'}
        />
        <Field
          icon={Clock}
          label="Duration"
          value={formatDuration(output['durationMs'] as number)}
          mono
          tone="success"
        />
        <Field
          icon={Layers}
          label="Resources"
          value={`${applied.length} appliqué${applied.length > 1 ? 's' : ''}`}
          tone="muted"
        />
      </div>
      {applied.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ressources appliquées</span>
          <ul className="space-y-0.5">
            {applied.map((r, i) => {
              const [kind, name] = r.includes('/') ? r.split('/', 2) : ['', r];
              return (
                <li
                  key={`${r}-${i}`}
                  className="flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2 py-1 text-xs"
                >
                  <K8sKindIcon kind={kind} />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{kind || 'resource'}</span>
                  <span className="font-mono text-foreground/90 truncate" title={name}>{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {artifacts && artifacts.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Artefacts liés</span>
          <ul className="space-y-0.5">
            {artifacts.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2 py-1 text-xs">
                <FileCode className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono text-foreground/90 truncate" title={a.name}>{a.name}</span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <JsonRawToggle output={output} />
    </div>
  );
}

function ScriptOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field icon={Folder} label="CWD" value={String(output['cwd'] ?? '—')} mono truncate />
        <Field
          icon={Terminal}
          label="Args"
          value={Array.isArray(output['args']) ? (output['args'] as string[]).join(' ') : String(output['args'] ?? '—')}
          mono
          truncate
        />
        <Field
          icon={Clock}
          label="Exit code"
          value={String(output['exitCode'] ?? '—')}
          mono
          tone={output['exitCode'] === 0 ? 'success' : 'error'}
        />
      </div>
      {output['stdout'] && typeof output['stdout'] === 'string' && (output['stdout'] as string).length > 0 && (
        <details open>
          <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground select-none">
            stdout
          </summary>
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted/60 border border-border px-3 py-2 text-[10px] font-mono leading-relaxed text-foreground/90 max-h-48">
            {String(output['stdout'])}
          </pre>
        </details>
      )}
      {output['stderr'] && typeof output['stderr'] === 'string' && (output['stderr'] as string).length > 0 && (
        <details>
          <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-status-error hover:text-status-error/80 select-none">
            stderr
          </summary>
          <pre className="mt-1 overflow-x-auto rounded-md bg-status-error/10 border border-status-error/30 px-3 py-2 text-[10px] font-mono leading-relaxed text-status-error/90 max-h-48">
            {String(output['stderr'])}
          </pre>
        </details>
      )}
      <JsonRawToggle output={output} />
    </div>
  );
}

function ProvisionOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field icon={Server} label="Namespace" value={String(output['namespace'] ?? '—')} mono truncate />
        <Field icon={Boxes} label="ServiceAccount" value={String(output['saName'] ?? '—')} mono truncate />
        <Field icon={Shield} label="Role" value={String(output['roleName'] ?? '—')} mono truncate />
        <Field icon={HardDrive} label="Binding" value={String(output['bindingName'] ?? '—')} mono truncate />
      </div>
      <JsonRawToggle output={output} />
    </div>
  );
}

function ScaffoldOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <Field icon={Folder} label="Path" value={String(output['path'] ?? '—')} mono truncate />
      </div>
      {output['repository'] && (
        <Field icon={GitBranch} label="Repository" value={String(output['repository'])} mono truncate />
      )}
      {output['cloned'] !== undefined && (
        <Field
          icon={CheckCheck}
          label="Status"
          value={String(output['cloned']) === 'true' ? 'Cloned' : 'Pending'}
          tone={String(output['cloned']) === 'true' ? 'success' : 'default'}
        />
      )}
      <JsonRawToggle output={output} />
    </div>
  );
}

function FetchOutputView({ output }: { output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <Field icon={Folder} label="Path" value={String(output['path'] ?? '—')} mono truncate />
        <Field icon={GitBranch} label="Repository" value={String(output['repository'] ?? '—')} mono truncate />
      </div>
      <JsonRawToggle output={output} />
    </div>
  );
}

function GenericOutputView({ action, output }: { action: string; output: Record<string, OutputValue> }): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Action : {action}
      </p>
      <pre className="overflow-x-auto rounded-md bg-muted/40 border border-border px-3 py-2 text-[10px] font-mono leading-relaxed text-foreground/90 max-h-48">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}

export function StepOutputView({ action, output, artifacts }: OutputViewProps): JSX.Element | null {
  if (!output) {
    return <p className="text-xs text-muted-foreground italic">Aucune sortie capturée</p>;
  }
  switch (action) {
    case 'build:image':
      return <BuildOutputView output={output} />;
    case 'push:image':
      return <PushOutputView output={output} />;
    case 'scan:image':
      return <ScanOutputView output={output} />;
    case 'deploy:manifest':
      return <DeployOutputView output={output} artifacts={artifacts} />;
    case 'run:script':
      return <ScriptOutputView output={output} />;
    case 'provision:infrastructure':
      return <ProvisionOutputView output={output} />;
    case 'scaffold:project':
      return <ScaffoldOutputView output={output} />;
    case 'fetch:template':
      return <FetchOutputView output={output} />;
    default:
      return <GenericOutputView action={action} output={output} />;
  }
}
