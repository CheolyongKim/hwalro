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
