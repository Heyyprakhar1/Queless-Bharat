import type React from 'react'
import type { HealthResponse } from '../types/health'

interface HealthPanelProps {
  health: HealthResponse | null
  healthLoading: boolean
  healthError: string | null
  lastChecked: Date | null
  onCheckHealth: () => void
}

export const HealthPanel: React.FC<HealthPanelProps> = ({
  health,
  healthLoading,
  healthError,
  lastChecked,
  onCheckHealth,
}) => {
  const isHealthy = health?.status === 'ok' && health?.database === 'connected'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Backend Health &amp; Readiness</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Connection verification with the modular monolith API and PostgreSQL.
          </p>
        </div>
        <button
          onClick={onCheckHealth}
          disabled={healthLoading}
          className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer shadow-xs"
        >
          {healthLoading ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            API Service
          </span>
          <div className="flex items-center space-x-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isHealthy
                  ? 'bg-emerald-500'
                  : healthError
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold text-slate-900">
              {healthError ? 'Unreachable' : health?.status === 'ok' ? 'Healthy' : 'Degraded'}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            PostgreSQL Database
          </span>
          <div className="flex items-center space-x-2">
            <span
              className={`w-3 h-3 rounded-full ${
                health?.database === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-900">
              {health?.database === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Environment
          </span>
          <div className="font-semibold text-slate-900 capitalize">
            {health?.environment || 'Unknown'}
          </div>
        </div>
      </div>

      {healthError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm mb-4">
          <strong>Connection Error:</strong> {healthError}. Ensure backend is running.
        </div>
      )}

      <div className="text-xs text-slate-400 flex items-center justify-between">
        <span>Automatic HTTP short polling active (30s interval)</span>
        {lastChecked && (
          <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}
