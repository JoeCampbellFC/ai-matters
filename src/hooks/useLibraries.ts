import { useQuery } from '@tanstack/react-query'
import { fetchLibraries } from '@/services/libraryService'

export function useLibraries(enabled: boolean) {
  return useQuery({
    queryKey: ['libraries'],
    queryFn: ({ signal }) => fetchLibraries(signal),
    enabled,
    staleTime: 5 * 60_000,
  })
}
