import { useState, useEffect, useMemo, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCatalogueApplications, type CatalogueFilters } from '@/hooks/useApplications';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationBar } from '@/components/ui/pagination-bar';
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
  getSortedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { getApplicationStatus } from '@/lib/status-config';
import type { Application } from '@kubernal/shared-types';

interface ApplicationTableProps {
  filters: CatalogueFilters;
  onFiltersChange: (filters: CatalogueFilters) => void;
}

export function ApplicationTable({ filters, onFiltersChange }: ApplicationTableProps): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogueApplications(filters);
  const [sorting, setSorting] = useState<SortingState>([]);

  const applications = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? 20)));

  const columnHelper = createColumnHelper<Application>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 gap-1"
            onClick={() => {
              const isAsc = column.getIsSorted() === 'asc';
              onFiltersChange({ ...filters, sortBy: 'name', sortOrder: isAsc ? 'desc' : 'asc' });
            }}
          >
            Nom
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: (info) => (
          <span
            className="font-medium cursor-pointer hover:text-primary"
            onClick={() => navigate(`/catalogue/${info.row.original.id}`)}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: (info) => info.getValue()?.slice(0, 60) ?? '-',
      }),
      columnHelper.accessor((row) => row.template?.name ?? '-', {
        id: 'templateName',
        header: 'Template',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('status', {
        header: 'Statut',
        cell: (info) => {
          const status = info.getValue();
          const config = getApplicationStatus(status);
          return (
            <Badge variant="outline" className={`flex items-center gap-1.5 ${config.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
              {config.label}
            </Badge>
          );
        },
      }),
      columnHelper.accessor((row) => row.team?.name ?? row.teamId, {
        id: 'teamName',
        header: 'Équipe',
        cell: (info) => info.getValue() ?? '-',
      }),
      columnHelper.accessor('createdAt', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 gap-1"
            onClick={() => {
              const isAsc = column.getIsSorted() === 'asc';
              onFiltersChange({
                ...filters,
                sortBy: 'createdAt',
                sortOrder: isAsc ? 'desc' : 'asc',
              });
            }}
          >
            Créé le
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: (info) => formatDate(info.getValue()),
      }),
    ],
    [navigate, filters],
  );

  const table = useReactTable({
    data: applications,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des applications');
  }, [error]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const responsive =
                    header.column.id === 'description' ? 'hidden md:table-cell' : '';
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const responsive =
                      cell.column.id === 'description' ? 'hidden md:table-cell' : '';
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
                  Aucune application trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        pagination={{
          page: filters.page ?? 0,
          pageSize: filters.pageSize ?? 20,
          totalPages,
          total,
          from: total === 0 ? 0 : (filters.page ?? 0) * (filters.pageSize ?? 20) + 1,
          to: Math.min(((filters.page ?? 0) + 1) * (filters.pageSize ?? 20), total),
        }}
        onPageChange={(page) => onFiltersChange({ ...filters, page })}
        onPageSizeChange={(pageSize) => onFiltersChange({ ...filters, pageSize, page: 0 })}
      />
    </div>
  );
}
