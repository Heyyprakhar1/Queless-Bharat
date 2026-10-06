import { useEffect, useState } from 'react'
import { fetchHealth } from './api/health'
import type { HealthResponse } from './types/health'

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHealth()
      setHealth(data)
      setLastChecked(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to backend')
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  // Periodic polling check (ADR-0005: 30s interval)
  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const isHealthy = health?.status === 'ok' && health?.database === 'connected'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              Q
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                QueueLess Bharat
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Milestone 1 Foundation
              </span>
            </div>
          </div>
          <a
            href="https://github.com/Heyyprakhar1/Queless-Bharat"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-500 hover:text-slate-800 transition"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Predictable Waiting for Public Services
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            <em>&ldquo;Making waiting more predictable, not pretending queues don&apos;t exist.&rdquo;</em>
          </p>
        </div>

        {/* Backend Connectivity Status Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Backend Health & Readiness</h2>
              <p className="text-sm text-slate-500">
                Real-time connection verification with the modular monolith API and PostgreSQL.
              </p>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer shadow-xs"
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Service Status */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                API Service
              </span>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isHealthy
                      ? 'bg-emerald-500'
                      : error
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold text-slate-900">
                  {error ? 'Unreachable' : health?.status === 'ok' ? 'Healthy' : 'Degraded'}
                </span>
              </div>
            </div>

            {/* Database Status */}
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

            {/* Environment Badge */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                Environment
              </span>
              <div className="font-semibold text-slate-900 capitalize">
                {health?.environment || 'Unknown'}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm mb-4">
              <strong>Connection Error:</strong> {error}. Ensure backend is running at{' '}
              <code>http://localhost:8000</code>.
            </div>
          )}

          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Automatic HTTP short polling active (30s interval)</span>
            {lastChecked && (
              <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* Foundation Architecture Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-2">Modular Monolith Architecture</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              FastAPI backend with distinct architectural layers: API routes, schemas, services,
              domain models, deterministic queue engine, assistive AI adapter, and persistence.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-2">PostgreSQL System of Record</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              ACID transactional storage for locations, counters, and immutable queue events.
              Local containerized PostgreSQL 16 ready for schema migrations via Alembic.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-slate-400">
          QueueLess Bharat &mdash; Milestone 1 Technical Application Foundation
        </div>
      </footer>
    </div>
  )
}

export default App
