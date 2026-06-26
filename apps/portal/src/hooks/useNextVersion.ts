import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export type BumpType = 'auto' | 'major' | 'minor' | 'patch';

export interface NextVersionResult {
  bump: BumpType;
  currentVersion: string | null;
  version: string;
  display: string;
  isPrerelease: boolean;
}

export function useNextVersion(
  applicationId: string | undefined,
  input: { bump: BumpType },
): UseQueryResult<NextVersionResult, Error> {
  return useQuery<NextVersionResult>({
    queryKey: ['deployments', 'next-version', applicationId, input.bump],
    queryFn: async () => {
      const r = await apiClient.post<{ data: NextVersionResult }>(
        '/deployments/next-version',
        input,
      );
      return r.data.data;
    },
    enabled: !!applicationId,
    staleTime: 5_000,
  });
}
