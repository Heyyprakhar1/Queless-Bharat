import type { HealthResponse } from '../types/health'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Fetches health and readiness status from the backend API.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
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
