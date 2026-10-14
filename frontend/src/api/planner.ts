import type { VisitPlanResponse } from '../types/planner'
import { getAuthHeaders } from './auth'
import { API_BASE_URL, ApiError, fetchWithTimeout } from './client'

/**
 * Fetches deterministic visit plan, arrival window, and document checklist for a service.
 */
export async function fetchVisitPlan(serviceId: string): Promise<VisitPlanResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/services/${serviceId}/visit-plan`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  })

  if (!response.ok) {
    let errorDetail = `Failed to fetch visit plan: HTTP ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson.detail) {
        errorDetail = errJson.detail
      }
    } catch {
      // ignore json parse error
    }
    throw new ApiError(response.status, errorDetail)
  }

  return response.json()
}
