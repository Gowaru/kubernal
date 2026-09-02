import { useState, useMemo, useEffect, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ExternalLink, Timer, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { useDeployments, useApproveDeployment } from '@/hooks/useDeployments';
import { useUsers } from '@/hooks/useUsers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import type { Deployment } from '@kubernal/shared-types';

const triggerLabels: Record<string, string> = {
  manual: 'Manuel',
  git_push: 'Git Push',
  scheduled: 'Planifié',
  rollback: 'Rollback',
};

const environmentOptions = [
  { value: '', label: 'Tous les environnements' },
  { value: 'dev', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'prod', label: 'Production' },
];

type EnrichedDeployment = Deployment & {
  applicationName: string;
  environmentType: string;
};

function formatDuration(startedAt: string | Date, completedAt: string | Date | null): string {
  if (!completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 1000) return '<1s';
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.round((diffMs % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function DeploymentTable(): JSX.Element {
  const navigate = useNavigate();
  const { data: deployments, isLoading, error } = useDeployments();
  const { data: users } = useUsers();
  const approveDeployment = useApproveDeployment();
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('');

  const enrichedDeployments = useMemo<EnrichedDeployment[]>(() => {
    if (!deployments) return [];
    return deployments
      .map((dep) => ({
        ...dep,
        applicationName: dep.application?.name ?? dep.applicationId.slice(0, 8),
        environmentType: dep.environment?.type ?? '',
      }))
      .filter((dep) => !envFilter || dep.environmentType === envFilter);
  }, [deployments, envFilter]);

  const columnHelper = createColumnHelper<EnrichedDeployment>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('applicationName', {
        header: 'Application',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('version', {
        header: 'Version',
        cell: (info) => {
          const v = info.getValue() as string;
          return (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
              <GitBranch className="h-3.5 w-3.5" />
              {v ?? '-'}
            </span>
          );
        },
      }),
      columnHelper.accessor('environmentType', {
        header: 'Environnement',
        cell: (info) => {
          const env = info.getValue() as string;
          const label = environmentOptions.find((o) => o.value === env)?.label ?? env;
          return <span className="text-sm">{label || '-'}</span>;
        },
      }),
      columnHelper.accessor('status', {
        header: 'Statut',
        cell: (info) => <StatusBadge status={info.getValue() as string} />,
      }),
      columnHelper.accessor('trigger', {
        header: 'Déclencheur',
        cell: (info) => {
          const trigger = info.getValue() as string;
          return (
            <span className="text-sm text-muted-foreground">
              {triggerLabels[trigger] ?? trigger}
            </span>
          );
        },
      }),
      columnHelper.accessor('startedAt', {
        header: 'Durée',
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              {formatDuration(row.startedAt, row.completedAt)}
            </span>
          );
        },
      }),
      columnHelper.accessor('createdAt', {
        header: 'Créé le',
        cell: (info) => (
          <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const row = info.row.original;
          const status = (row.status as string).toUpperCase();
          const isPending = status === 'PENDING';
          return (
            <div className="flex items-center gap-2">
              {isPending && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    approveDeployment.mutate(
                      { id: row.id, approvedById: users?.[0]?.id ?? '' },
                      {
                        onSuccess: () => toast.success('Déploiement approuvé'),
                        onError: () => toast.error("Erreur lors de l'approbation"),
                      },
                    )
                  }
                  disabled={approveDeployment.isPending || !users?.length}
                  title={!users?.length ? 'Aucun utilisateur' : undefined}
                >
                  Approuver
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => navigate(`/deployments/${row.id}`)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [navigate, approveDeployment, users],
  );

  const table = useReactTable({
    data: enrichedDeployments,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des déploiements');
  }, [error]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un déploiement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {environmentOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEnvFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                envFilter === opt.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const responsive = ['trigger', 'startedAt', 'createdAt'].includes(
                    header.column.id,
                  )
                    ? 'hidden sm:table-cell'
                    : '';
                  return (
                    <TableHead key={header.id} className={responsive}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    navigate(`/deployments/${row.original.id}`);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const responsive = ['trigger', 'startedAt', 'createdAt'].includes(
                      cell.column.id,
                    )
                      ? 'hidden sm:table-cell'
                      : '';
                    return (
                      <TableCell key={cell.id} className={responsive}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {envFilter
                    ? 'Aucun déploiement pour cet environnement'
                    : 'Aucun déploiement trouvé'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}
