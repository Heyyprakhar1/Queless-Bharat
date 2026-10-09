import type { GoogleAuthConfig, LoginCredentials, RegisterData, TokenResponse, User } from '../types/auth'
import { API_BASE_URL, fetchWithTimeout } from './client'

const TOKEN_KEY = 'queless_access_token'
const USER_KEY = 'queless_auth_user'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY)
  if (!userJson) return null
  try {
    return JSON.parse(userJson) as User
  } catch {
    return null
  }
}

export function setAuthSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Login failed: HTTP ${response.status}`)
  }

  const data: TokenResponse = await response.json()
  setAuthSession(data.access_token, data.user)
  return data
}

export async function register(data: RegisterData): Promise<TokenResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Registration failed: HTTP ${response.status}`)
  }

  // Automatically login upon registration to obtain access token
  return login({ email: data.email, password: data.password })
}

export async function fetchGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/google/config`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return { enabled: false, client_id: null }
    }
    return await response.json()
  } catch {
    return { enabled: false, client_id: null }
  }
}

export async function googleLogin(idToken: string): Promise<TokenResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ id_token: idToken }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Google sign-in failed: HTTP ${response.status}`)
  }

  const data: TokenResponse = await response.json()
  setAuthSession(data.access_token, data.user)
  return data
}

export async function citizenAccess(_fullName: string, _email: string): Promise<TokenResponse> {
  throw new Error(
    'The unauthenticated citizen-access endpoint has been retired. Please use Sign in with Google.'
  )
}

export async function getMe(): Promise<User> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession()
    }
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.detail || `Failed to fetch user: HTTP ${response.status}`)
  }

  const user: User = await response.json()
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export async function logout(): Promise<void> {
  const token = getAuthToken()
  if (token) {
    try {
      await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
    } catch {
      // Best-effort logout notification
    }
  }
  clearAuthSession()
}
