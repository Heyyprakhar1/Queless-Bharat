/**
 * Backend health check response contract.
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | string
  database: 'connected' | 'disconnected' | string
  environment: string
}
