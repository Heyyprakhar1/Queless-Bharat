import type {
  Location,
  QueueSession,
  QueueStatusResponse,
  Service,
  UserQueueStatusResponse,
} from '../types/queue'
import { getAuthHeaders } from './auth'
import { API_BASE_URL, fetchWithTimeout } from './client'

/**
 * Fetches distinct cities with registered facilities.
 */
export async function fetchCities(): Promise<string[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/locations/cities`, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch cities: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Fetches registered public service locations, optionally filtered by city.
 */
export async function fetchLocations(city?: string): Promise<Location[]> {
  const url = city
    ? `${API_BASE_URL}/api/v1/locations?city=${encodeURIComponent(city)}`
    : `${API_BASE_URL}/api/v1/locations`
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
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
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
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
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/services/${encodeURIComponent(serviceId)}/queue-status`,
    {
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch queue status: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Checks in a citizen into a service queue (idempotent, authenticated).
 */
export async function checkInQueue(
  serviceId: string,
  userId?: string,
  idempotencyKey?: string
): Promise<QueueSession> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/queue/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      service_id: serviceId,
      user_id: userId || null,
      idempotency_key: idempotencyKey || null,
    }),
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Failed to check in: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Fetches user-specific queue status including 1-based position and personal estimate.
 */
export async function fetchUserQueueStatus(sessionId: string): Promise<UserQueueStatusResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/queue/${encodeURIComponent(sessionId)}/status`,
    {
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
    }
  )
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Failed to fetch ticket status: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Starts service for a waiting participant (operator desk action).
 */
export async function startService(
  sessionId: string,
  counterId?: string,
  idempotencyKey?: string
): Promise<QueueSession> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/queue/${encodeURIComponent(sessionId)}/start`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        counter_id: counterId || null,
        idempotency_key: idempotencyKey || null,
      }),
    }
  )
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Failed to start service: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Completes service for an active participant (operator desk action).
 */
export async function completeService(
  sessionId: string,
  idempotencyKey?: string
): Promise<QueueSession> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/queue/${encodeURIComponent(sessionId)}/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey || null,
      }),
    }
  )
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Failed to complete service: HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Cancels a queue session (citizen departure or abandonment).
 */
export async function cancelQueueSession(
  sessionId: string,
  reason?: string,
  idempotencyKey?: string
): Promise<QueueSession> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/queue/${encodeURIComponent(sessionId)}/cancel`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        reason: reason || 'Citizen requested departure',
        idempotency_key: idempotencyKey || null,
      }),
    }
  )
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Failed to cancel session: HTTP ${response.status}`)
  }
  return response.json()
}
