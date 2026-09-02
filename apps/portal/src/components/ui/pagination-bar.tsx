import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { type JSX } from 'react';
import type { PaginationState } from '@/hooks/usePagination';

interface PaginationBarProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationBar({
  pagination,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps): JSX.Element {
  const { page, pageSize, totalPages, total, from, to } = pagination;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        {from} à {to} sur {total} résultat{total !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-[70px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {[10, 20, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                <span className="text-xs">{size}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(0)}
            disabled={page === 0}
          >
            <ChevronsLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>

          <div className="flex items-center gap-0.5 px-1">
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? 'secondary' : 'outline'}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => onPageChange(p as number)}
                >
                  {(p as number) + 1}
                </Button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronsRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages: (number | '...')[] = [0];

  if (current > 2) pages.push('...');

  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 3) pages.push('...');

  pages.push(total - 1);

  return pages;
}
