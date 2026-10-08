export type LocationCategory = 'hospital' | 'rto' | 'government_office'

export interface Location {
  id: string
  name: string
  category: LocationCategory
  address: string
  city: string
  state: string
  timezone: string
  latitude?: number | null
  longitude?: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  location_id: string
  name: string
  description?: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Counter {
  id: string
  service_id: string
  name: string
  status: string
  created_at: string
  updated_at: string
}

export type QueueSessionStatus = 'WAITING' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED'

export interface QueueSession {
  id: string
  service_id: string
  user_id?: string | null
  status: QueueSessionStatus
  checked_in_at: string
  service_started_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  created_at: string
  updated_at: string
}

export interface WaitEstimate {
  is_available: boolean
  lower_minutes?: number | null
  upper_minutes?: number | null
  expected_minutes?: number | null
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH' | null
  sample_size: number
  freshness_seconds?: number | null
  model_version: string
  reason?: string | null
  supporting_signals?: Record<string, unknown>
}

export interface QueueStateSummary {
  waiting_count: number
  in_service_count: number
  active_counters: number
}

export interface QueueStatusResponse {
  service: Service
  queue_state: QueueStateSummary
  people_ahead: number
  active_counters: number
  estimated_wait: WaitEstimate
  is_simulated?: boolean
}

export interface UserQueueStatusResponse {
  session: QueueSession
  service: Service
  position: number | null
  people_ahead: number
  queue_state: QueueStateSummary
  estimated_wait: WaitEstimate
  is_simulated?: boolean
}
