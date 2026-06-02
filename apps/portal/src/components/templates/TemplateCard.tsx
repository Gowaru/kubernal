import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileJson, GitBranch, Box, Globe, Layers, FunctionSquare } from 'lucide-react';
import type { GoldenPathTemplate, TemplateCategory } from '@kubernal/shared-types';

const categoryConfig: Record<TemplateCategory, { label: string; className: string; icon: typeof FileJson }> = {
  backend: {
    label: 'Backend',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: Box,
  },
  frontend: {
    label: 'Frontend',
    className: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    icon: Globe,
  },
  fullstack: {
    label: 'Fullstack',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: Layers,
  },
  library: {
    label: 'Library',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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

  return (
    <Card className="group transition-all duration-200 hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-blue-400 transition-colors">
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
        <Button size="sm" variant="outline">
          Détails
        </Button>
      </CardFooter>
    </Card>
  );
}
