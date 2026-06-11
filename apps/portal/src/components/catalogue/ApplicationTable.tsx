import { useState, useMemo, useEffect, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { useApplications } from '@/hooks/useApplications';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { getApplicationStatus } from '@/lib/status-config';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import type { Application } from '@kubernal/shared-types';

export function ApplicationTable(): JSX.Element {
  const navigate = useNavigate();
  const { data: applications, isLoading, error } = useApplications();
  const [search, setSearch] = useState('');

  const columnHelper = createColumnHelper<Application>();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Nom',
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
      header: 'Créé le',
      cell: (info) => formatDate(info.getValue()),
    }),
  ], [navigate]);

  const table = useReactTable({
    data: applications ?? [],
    columns,
    state: { globalFilter: search, pagination: { pageIndex: 0, pageSize: 10 } },
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    if (error) toast.error('Erreur lors du chargement des applications');
  }, [error]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher une application..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const responsive = header.column.id === 'description' ? 'hidden md:table-cell' : '';
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
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const responsive = cell.column.id === 'description' ? 'hidden md:table-cell' : '';
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Aucune application trouvée
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
