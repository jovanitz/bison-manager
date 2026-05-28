import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemDto } from '@acme/application';
import { useUseCases } from '../di/use-cases-context';

/**
 * TanStack Query bindings for the example module.
 *
 * Server/async state lives here (TanStack Query); the use cases are the only
 * thing these hooks call. The hooks never know whether the data comes from
 * IndexedDB, REST, or a mock — that is the composition root's secret. Mutations
 * invalidate the list query, which (combined with the offline repository) gives
 * optimistic, offline-friendly updates.
 */
const ITEMS_KEY = ['items'] as const;

export const useItems = (includeArchived = false) => {
  const { items } = useUseCases();
  return useQuery({
    queryKey: [...ITEMS_KEY, { includeArchived }],
    queryFn: () => items.list({ includeArchived }),
  });
};

export const useCreateItem = () => {
  const { items } = useUseCases();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const result = await items.create(input);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
};

export const useArchiveItem = () => {
  const { items } = useUseCases();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string }): Promise<ItemDto> => {
      const result = await items.archive(input);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
};
