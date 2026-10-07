export type UserRole = 'CITIZEN' | 'OPERATOR' | 'ADMIN'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  assigned_service_id?: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
  role?: UserRole
  assigned_service_id?: string | null
}
