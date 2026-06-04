import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { FileJson, GitBranch, Box, Globe, Layers, FunctionSquare, Hash, Settings2, ListOrdered } from 'lucide-react';
import type { GoldenPathTemplate, TemplateCategory } from '@kubernal/shared-types';

const categoryConfig: Record<TemplateCategory, { label: string; className: string; icon: typeof FileJson }> = {
  backend: {
    label: 'Backend',
    className: 'bg-category-security/10 text-category-security border-category-security/20',
    icon: Box,
  },
  frontend: {
    label: 'Frontend',
    className: 'bg-category-compliance/10 text-category-compliance border-category-compliance/20',
    icon: Globe,
  },
  fullstack: {
    label: 'Fullstack',
    className: 'bg-category-cost/10 text-category-cost border-category-cost/20',
    icon: Layers,
  },
  library: {
    label: 'Library',
    className: 'bg-category-ops/10 text-category-ops border-category-ops/20',
    icon: FunctionSquare,
  },
  function: {
    label: 'Function',
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    icon: FileJson,
  },
};

interface TemplateCardProps {
  template: GoldenPathTemplate;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const category = categoryConfig[template.category] ?? categoryConfig.library;
  const CategoryIcon = category.icon;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const parameterEntries = Object.entries(template.parameters ?? {});
  const createdAt = template.createdAt instanceof Date
    ? template.createdAt
    : new Date(template.createdAt);

  return (
    <>
      <Card className="group transition-all duration-200 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
                <FileJson className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-accent transition-colors">
                  {template.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  v{template.version}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {template.description}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`flex items-center gap-1 ${category.className}`}>
              <CategoryIcon className="h-3 w-3" />
              {category.label}
            </Badge>
            <Badge variant="outline" className="bg-secondary/50 text-muted-foreground border-border">
              {template.steps?.length ?? 0} étapes
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate">{template.repository}</span>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border px-5 py-3 flex gap-2">
          <Button size="sm" variant="default" className="flex-1">
            Utiliser
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDetailsOpen(true)}>
            Détails
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20 shrink-0">
                <FileJson className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">{template.name}</DialogTitle>
                <DialogDescription className="line-clamp-2">
                  {template.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`flex items-center gap-1 ${category.className}`}>
                <CategoryIcon className="h-3 w-3" />
                {category.label}
              </Badge>
              <Badge variant="outline" className="bg-secondary/50 text-muted-foreground border-border">
                v{template.version}
              </Badge>
              <Badge variant="outline" className="bg-secondary/50 text-muted-foreground border-border">
                {template.steps?.length ?? 0} étapes
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField
                icon={Hash}
                label="Identifiant"
                value={template.id}
                mono
              />
              <DetailField
                icon={Settings2}
                label="Version"
                value={`v${template.version}`}
                mono
              />
              <DetailField
                icon={GitBranch}
                label="Dépôt"
                value={template.repository}
                mono
                className="sm:col-span-2"
              />
              <DetailField
                icon={ListOrdered}
                label="Créé le"
                value={createdAt.toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              />
              <DetailField
                icon={FileJson}
                label="Catégorie"
                value={category.label}
              />
            </div>

            {parameterEntries.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Paramètres</p>
                  <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
                    {parameterEntries.map(([key, value]) => {
                      const isObject = value !== null && typeof value === 'object';
                      const obj = isObject ? (value as Record<string, unknown>) : null;
                      const display = isObject
                        ? obj?.default !== undefined
                          ? String(obj.default)
                          : obj?.type
                            ? String(obj.type)
                            : JSON.stringify(value)
                        : String(value);
                      const desc = isObject && obj?.description ? String(obj.description) : null;
                      return (
                        <div
                          key={key}
                          className="flex items-start gap-3 px-3 py-2 text-sm"
                        >
                          <span className="font-mono text-xs text-muted-foreground shrink-0 min-w-32">
                            {key}
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <span className="font-mono text-xs text-foreground break-all">
                              {display}
                            </span>
                            {desc && (
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {template.steps && template.steps.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Étapes ({template.steps.length})
                  </p>
                  <ol className="space-y-2">
                    {template.steps.map((step, index) => (
                      <li
                        key={step.id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-medium truncate">{step.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {step.action}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface DetailFieldProps {
  icon: typeof FileJson;
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}

function DetailField({ icon: Icon, label, value, mono, className }: DetailFieldProps) {
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`text-sm break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
