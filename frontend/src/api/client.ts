/**
 * Centralized HTTP request client with timeout protection and safe error handling.
 */

/**
 * Resolves the API base URL.
 * Defaults to an empty string ('') for same-origin relative proxying in standard
 * Docker / Nginx and production deployments.
 * If an explicit VITE_API_BASE_URL is provided (e.g. for direct development testing),
 * it is sanitized (trailing slashes stripped) and respected.
 */
export function resolveApiBaseUrl(
  envValue?: string | null
): string {
  const resolved =
    envValue !== undefined
      ? envValue
      : typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_API_BASE_URL
        : undefined

  if (typeof resolved === 'string' && resolved.trim() !== '') {
    return resolved.trim().replace(/\/+$/, '')
  }
  return ''
}

export const API_BASE_URL = resolveApiBaseUrl()

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
}

/**
 * Executes a fetch request with timeout support via AbortController.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestOptions = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
    })
    return response
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export class ApiError extends Error {
  status: number
  detail?: string
  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}
