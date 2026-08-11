import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/context/AuthContext';
import { drawingApi } from '../api/drawingApi';

export function useDrawingList(page: number, size: number) {
  const { user } = useAuth();
  const userId = user?.id ?? 'unknown';

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['drawings', userId, page, size],
    queryFn: () => drawingApi.list(page, size),
  });

  return {
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    isPending,
    isError,
    error,
  };
}
