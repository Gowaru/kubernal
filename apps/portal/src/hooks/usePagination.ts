import { useState, useEffect, useMemo, useCallback } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
}

export function usePagination<T>(data: T[], defaultPageSize = 10) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(0);
  }, [total]);

  const safePage = Math.min(page, totalPages - 1);

  const paginatedData = useMemo(
    () => data.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [data, safePage, pageSize],
  );

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(0);
  }, []);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize: changePageSize,
    totalPages,
    total,
    from: total === 0 ? 0 : safePage * pageSize + 1,
    to: Math.min((safePage + 1) * pageSize, total),
    paginatedData,
  } satisfies PaginationState & { setPage: (p: number) => void; setPageSize: (s: number) => void; paginatedData: T[] };
}
