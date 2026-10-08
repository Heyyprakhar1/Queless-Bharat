import type { HealthResponse } from '../types/health'
import { API_BASE_URL, fetchWithTimeout } from './client'

/**
 * Fetches health and readiness status from the backend API.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/health`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok && response.status !== 503) {
    throw new Error(`Health check failed with HTTP ${response.status}`)
  }

  const data: HealthResponse = await response.json()
  return data
}
