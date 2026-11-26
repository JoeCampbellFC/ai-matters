import { apiRequest } from './api'
import type { MatterDashboardResponse } from '@/types/dashboard'

/** Cache-only lookup -- never triggers LLM generation. Used on initial page load. */
export async function fetchDashboard(workspaceId: string): Promise<MatterDashboardResponse> {
  return apiRequest<MatterDashboardResponse>(`/matters/${encodeURIComponent(workspaceId)}/dashboard`)
}

/** Generates (or returns the already-cached) projection for the matter's current Markdown version. */
export async function generateDashboard(workspaceId: string): Promise<MatterDashboardResponse> {
  return apiRequest<MatterDashboardResponse>(`/matters/${encodeURIComponent(workspaceId)}/dashboard/generate`, {
    method: 'POST',
  })
}
