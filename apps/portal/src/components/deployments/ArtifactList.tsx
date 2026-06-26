import { type JSX, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Shield,
  FileCode,
  GitBranch,
  Globe,
  File,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Check,
  type LucideIcon,
} from 'lucide-react';
import type { Artifact } from '@kubernal/shared-types';
import { cn } from '@/lib/utils';

type ArtifactKind = 'image' | 'scan' | 'manifest' | 'git' | 'webhook' | 'unknown';

interface ArtifactKindMeta {
  label: string;
  icon: LucideIcon;
  tone: string;
  chip: string;
}

const KIND_META: Record<ArtifactKind, ArtifactKindMeta> = {
  image: {
    label: 'Image',
    icon: Container,
    tone: 'text-status-info',
    chip: 'border-status-info/30 bg-status-info/10',
  },
  scan: {
    label: 'Scan',
    icon: Shield,
    tone: 'text-status-warning',
    chip: 'border-status-warning/30 bg-status-warning/10',
  },
  manifest: {
    label: 'Manifest',
    icon: FileCode,
    tone: 'text-status-success',
    chip: 'border-status-success/30 bg-status-success/10',
  },
  git: {
    label: 'Git',
    icon: GitBranch,
    tone: 'text-muted-foreground',
    chip: 'border-muted-foreground/30 bg-muted',
  },
  webhook: {
    label: 'Webhook',
    icon: Globe,
    tone: 'text-accent',
    chip: 'border-accent/30 bg-accent/10',
  },
  unknown: {
    label: 'Fichier',
    icon: File,
    tone: 'text-muted-foreground',
    chip: 'border-muted-foreground/30 bg-muted',
  },
};

function detectKind(name: string, url: string | undefined): ArtifactKind {
  const n = name.toLowerCase();
  const u = (url ?? '').toLowerCase();
  if (n.startsWith('image') || n.startsWith('sha256:') || u.startsWith('localhost:5000') || u.startsWith('ghcr.io/')) {
    return 'image';
  }
  if (n.includes('scan') || n.includes('trivy') || n.includes('grype') || n.includes('vulnerab')) {
    return 'scan';
  }
  if (n.includes('manifest') || u.startsWith('k8s://') || u.endsWith('.yaml') || u.endsWith('.yml')) {
    return 'manifest';
  }
  if (u.startsWith('git://') || u.includes('github.com') || u.includes('gitlab.com')) {
    return 'git';
  }
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return 'webhook';
  }
  return 'unknown';
}

function CopyButton({ text, label }: { text: string; label: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="shrink-0 inline-flex items-center gap-1 rounded border border-border bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      title={`Copier ${label}`}
    >
      {copied ? <Check className="h-2.5 w-2.5 text-status-success" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
}

interface ArtifactItemProps {
  artifact: Artifact;
  kind: ArtifactKind;
  isExpanded: boolean;
  onToggle: () => void;
}

function ArtifactItem({ artifact, kind, isExpanded, onToggle }: ArtifactItemProps): JSX.Element {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const displayUrl = artifact.url ?? '';
  const hasUrl = displayUrl.startsWith('http');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-md border border-border bg-card/30 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.tone)} />
          <span className={cn('text-[10px] uppercase tracking-wide shrink-0', meta.tone)}>
            {meta.label}
          </span>
          <span
            className="font-mono text-xs text-foreground/90 truncate min-w-0 flex-1"
            title={artifact.name}
          >
            {artifact.name}
          </span>
        </button>
        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{artifact.size}</span>
        {displayUrl && <CopyButton text={displayUrl} label="URL" />}
        {hasUrl && (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Ouvrir"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <AnimatePresence>
        {isExpanded && displayUrl && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <pre className="px-3 py-2 text-[10px] font-mono text-muted-foreground bg-muted/40 break-all">
              {displayUrl}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ArtifactListProps {
  artifacts: Artifact[];
}

export function ArtifactList({ artifacts }: ArtifactListProps): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ArtifactKind | 'all'>('all');

  const groups = useMemo(() => {
    const byKind: Record<ArtifactKind, Artifact[]> = {
      image: [],
      scan: [],
      manifest: [],
      git: [],
      webhook: [],
      unknown: [],
    };
    for (const artifact of artifacts) {
      const kind = detectKind(artifact.name, artifact.url);
      byKind[kind].push(artifact);
    }
    return byKind;
  }, [artifacts]);

  const counts = useMemo(
    () => ({
      image: groups.image.length,
      scan: groups.scan.length,
      manifest: groups.manifest.length,
      git: groups.git.length,
      webhook: groups.webhook.length,
      unknown: groups.unknown.length,
    }),
    [groups],
  );

  const visibleKinds: ArtifactKind[] = (Object.keys(groups) as ArtifactKind[]).filter((k) => {
    if (filter === 'all') return counts[k] > 0;
    return k === filter;
  });

  if (artifacts.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">Aucun artefact</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
            filter === 'all'
              ? 'border-foreground/40 bg-foreground/10 text-foreground'
              : 'border-border bg-card/50 text-muted-foreground hover:text-foreground',
          )}
        >
          Tous <span className="font-mono">{artifacts.length}</span>
        </button>
        {(Object.keys(KIND_META) as ArtifactKind[]).map((k) => {
          if (counts[k] === 0) return null;
          const meta = KIND_META[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                filter === k ? meta.chip + ' ' + meta.tone : 'border-border bg-card/50 text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              <span className="font-mono">{counts[k]}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {visibleKinds.flatMap((kind) =>
            groups[kind].map((artifact, i) => {
              const key = `${kind}-${artifact.name}-${i}`;
              return (
                <ArtifactItem
                  key={key}
                  artifact={artifact}
                  kind={kind}
                  isExpanded={expanded.has(key)}
                  onToggle={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                />
              );
            }),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
