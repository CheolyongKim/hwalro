import { useMutation, useQueryClient } from '@tanstack/react-query';
import { drawingApi } from '../api/drawingApi';
import type { DrawingCreateRequest } from '../types/drawing';

export function useCreateDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DrawingCreateRequest) => drawingApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drawings'] }),
  });
}

export function useDeleteDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => drawingApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drawings'] }),
  });
}
