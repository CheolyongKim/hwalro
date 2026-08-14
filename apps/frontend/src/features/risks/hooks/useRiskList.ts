import { useQuery } from '@tanstack/react-query';
import { riskApi } from '../api/riskApi';

export function useRiskList(page: number, pageSize: number) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['risks', page, pageSize],
    queryFn: () => riskApi.list(page, pageSize),
  });

  return {
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    isPending,
    isError,
    error,
  };
}

export function useRiskDetail(id: number | null, enabled = true) {
  return useQuery({
    queryKey: ['risks', 'detail', id],
    queryFn: () => {
      if (id === null) throw new Error('Risk id is required.');
      return riskApi.get(id);
    },
    enabled: enabled && id !== null,
  });
}
