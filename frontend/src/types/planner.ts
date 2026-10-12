import type { EstimateConfidence } from './queue'

export type DocumentRequirementType =
  | 'ORIGINAL_ONLY'
  | 'PHOTOCOPY_ONLY'
  | 'BOTH_ORIGINAL_AND_PHOTOCOPY'

export type VerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED'

export interface DocumentChecklistItem {
  id: string
  name: string
  description: string
  requirement_type: DocumentRequirementType
  is_mandatory: boolean
  is_conditional?: boolean
  condition_description?: string | null
  notes?: string | null
}

export interface DocumentChecklist {
  service_id: string
  service_name: string
  verification_status?: VerificationStatus
  has_verified_checklist: boolean
  source_title?: string | null
  source_url?: string | null
  verification_date?: string | null
  disclaimer: string
  items: DocumentChecklistItem[]
}

export interface ArrivalWindowRecommendation {
  is_recommended: boolean
  confidence?: EstimateConfidence | null
  window_start_minutes?: number | null
  window_end_minutes?: number | null
  suggested_arrival_text?: string | null
  data_freshness_seconds?: number | null
  last_updated?: string | null
  reason?: string | null
  assumptions: string[]
  disclaimer: string
}

export interface VisitPlanResponse {
  service_id: string
  service_name: string
  location_name: string
  city: string
  arrival_window: ArrivalWindowRecommendation
  document_checklist: DocumentChecklist
  is_simulated: boolean
}
