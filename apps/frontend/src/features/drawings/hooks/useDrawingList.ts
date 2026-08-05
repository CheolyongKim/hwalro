import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { drawingApi } from '../api/drawingApi';

const PAGE_SIZE = 20;

export function useDrawingList() {
  const { user } = useAuth();
  const userId = user?.id ?? 'unknown';

  const { data, hasNextPage, isPending, isError, error, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['drawings', userId],
      queryFn: ({ pageParam }) => drawingApi.list(pageParam, PAGE_SIZE),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    });

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const totalCount = data?.pages[0]?.totalCount ?? 0;

  return {
    items,
    totalCount,
    hasNextPage,
    isPending,
    isError,
    error,
    fetchNextPage,
    isFetchingNextPage,
  };
}
