import { apiRequest } from './api'
import type { Library } from '@/types/workspace'

export async function fetchLibraries(signal?: AbortSignal): Promise<Library[]> {
  const { libraries } = await apiRequest<{ libraries: Library[] }>('/libraries', { signal })
  return libraries
}
