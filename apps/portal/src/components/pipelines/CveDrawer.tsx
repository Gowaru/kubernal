import { useState, useMemo, type JSX } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useDeploymentVulnerabilities } from '@/hooks/useDeploymentVulnerabilities';

interface CveDrawerProps {
  deploymentId: string | null;
  open: boolean;
  onClose: () => void;
}

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'text-red-400 bg-red-400/10 border-red-500/30' },
  HIGH: { color: 'text-orange-400 bg-orange-400/10 border-orange-500/30' },
  MEDIUM: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30' },
  LOW: { color: 'text-zinc-400 bg-zinc-400/10 border-zinc-500/30' },
} as const;

type SeverityKey = keyof typeof SEVERITY_CONFIG;

function SeverityBadge({ severity }: { severity: string }): JSX.Element {
  const key = severity.toUpperCase() as SeverityKey;
  const cfg = SEVERITY_CONFIG[key];
  if (!cfg) {
    return <Badge variant="outline" className="text-xs">{severity}</Badge>;
  }
  return (
    <Badge variant="outline" className={`text-xs ${cfg.color}`}>
      {severity}
    </Badge>
  );
}

export function CveDrawer({ deploymentId, open, onClose }: CveDrawerProps): JSX.Element {
  const { data: vulnerabilities, isLoading } = useDeploymentVulnerabilities(deploymentId ?? undefined);
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!vulnerabilities) return [];
    if (!filter || filter === 'Toutes') return vulnerabilities;
    return vulnerabilities.filter((v) => v.severity.toUpperCase() === filter);
  }, [vulnerabilities, filter]);

  const severityCounts = useMemo(() => {
    if (!vulnerabilities) return {};
    const counts: Record<string, number> = {};
    for (const v of vulnerabilities) {
      const key = v.severity.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [vulnerabilities]);

  const filters = ['Toutes', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  return (
    <Sheet open={open} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Vulnérabilités
            {vulnerabilities && (
              <span className="text-sm font-normal text-muted-foreground">
                ({vulnerabilities.length})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && vulnerabilities && vulnerabilities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldAlert className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Aucune vulnérabilité trouvée</p>
          </div>
        )}

        {!isLoading && vulnerabilities && vulnerabilities.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {filters.map((f) => {
                const key = f as SeverityKey;
                const count = f === 'Toutes' ? vulnerabilities.length : (severityCounts[key] ?? 0);
                const isActive = filter === f || (f === 'Toutes' && !filter);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f === 'Toutes' ? null : f)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {f}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {filtered.map((vuln) => (
                <div
                  key={vuln.id}
                  className="rounded-lg border border-border p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-medium text-foreground">
                      {vuln.cveId}
                    </code>
                    <SeverityBadge severity={vuln.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{vuln.title}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>
                      {vuln.packageName}
                      <span className="opacity-50">@{vuln.packageVersion}</span>
                    </span>
                    {vuln.fixedVersion && (
                      <span>
                        Fixe : <span className="text-emerald-400">{vuln.fixedVersion}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
