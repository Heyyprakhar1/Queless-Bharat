import type { Location, QueueStatusResponse, Service } from '../types/queue'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Fetches all registered public service locations.
 */
export async function fetchLocations(): Promise<Location[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/locations`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch locations: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Fetches services, optionally filtered by location ID.
 */
export async function fetchServices(locationId?: string): Promise<Service[]> {
  const url = locationId
    ? `${API_BASE_URL}/api/v1/services?location_id=${encodeURIComponent(locationId)}`
    : `${API_BASE_URL}/api/v1/services`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch services: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Fetches queue state and deterministic wait projection for a specific service.
 */
export async function fetchQueueStatus(serviceId: string): Promise<QueueStatusResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/services/${encodeURIComponent(serviceId)}/queue-status`,
    {
      headers: { Accept: 'application/json' },
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch queue status: HTTP ${response.status}`)
  }
  return response.json()
}
