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

export interface NextVersionInput {
  bump: BumpType;
  currentVersion?: string;
  commitSha?: string;
  branch?: string;
}

export function useNextVersion(
  applicationId: string | undefined,
  input: NextVersionInput,
): UseQueryResult<NextVersionResult, Error> {
  return useQuery<NextVersionResult>({
    queryKey: ['deployments', 'next-version', applicationId, input],
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
