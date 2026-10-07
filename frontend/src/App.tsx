import { useEffect, useState } from 'react'
import { fetchHealth } from './api/health'
import { fetchQueueStatus, fetchServices } from './api/queue'
import type { HealthResponse } from './types/health'
import type { QueueStatusResponse, Service } from './types/queue'

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState<boolean>(true)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Queue domain state
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null)
  const [queueLoading, setQueueLoading] = useState<boolean>(false)
  const [queueError, setQueueError] = useState<string | null>(null)

  const checkHealth = async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const data = await fetchHealth()
      setHealth(data)
      setLastChecked(new Date())
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Unable to connect to backend')
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }

  const loadCatalog = async () => {
    try {
      const svcs = await fetchServices()
      setServices(svcs)
      if (svcs.length > 0 && !selectedServiceId) {
        setSelectedServiceId(svcs[0].id)
      }
    } catch {
      // Catalog might be empty on initial boot
    }
  }

  const loadQueueStatus = async (serviceId: string) => {
    if (!serviceId) return
    setQueueLoading(true)
    setQueueError(null)
    try {
      const status = await fetchQueueStatus(serviceId)
      setQueueStatus(status)
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to fetch queue status')
      setQueueStatus(null)
    } finally {
      setQueueLoading(false)
    }
  }

  // Initial load and periodic polling (ADR-0005: 30s interval)
  useEffect(() => {
    checkHealth()
    loadCatalog()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Poll selected service queue status when available
  useEffect(() => {
    if (selectedServiceId) {
      loadQueueStatus(selectedServiceId)
      const queueInterval = setInterval(() => {
        loadQueueStatus(selectedServiceId)
      }, 15000)
      return () => clearInterval(queueInterval)
    }
  }, [selectedServiceId])

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
                Milestone 2 Domain & Engine
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
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 w-full space-y-10">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Predictable Waiting for Public Services
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            <em>&ldquo;Making waiting more predictable, not pretending queues don&apos;t exist.&rdquo;</em>
          </p>
        </div>

        {/* Queue Status & Deterministic Estimator Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Queue Intelligence Monitor</h2>
              <p className="text-sm text-slate-500">
                Live queue state and pure mathematical wait estimation (ADR-0003).
              </p>
            </div>

            {services.length > 0 && (
              <div className="flex items-center space-x-3">
                <label htmlFor="service-select" className="text-xs font-medium text-slate-500">
                  Service:
                </label>
                <select
                  id="service-select"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => loadQueueStatus(selectedServiceId)}
                  disabled={queueLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  {queueLoading ? '...' : 'Refresh'}
                </button>
              </div>
            )}
          </div>

          {services.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-600 text-sm">
              <p className="font-medium text-slate-800 mb-1">No Public Services Registered Yet</p>
              <p className="text-xs text-slate-500">
                Use the REST API (<code>POST /api/v1/locations</code> &amp; <code>POST /api/v1/services</code>) to register facilities.
              </p>
            </div>
          ) : queueStatus ? (
            <div className="space-y-6">
              {/* Queue Metrics Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                    Service
                  </span>
                  <div className="font-bold text-slate-900 truncate">
                    {queueStatus.service.name}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                    People Ahead
                  </span>
                  <div className="text-2xl font-black text-indigo-600">
                    {queueStatus.people_ahead}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                    Active Counters
                  </span>
                  <div className="text-2xl font-black text-emerald-600">
                    {queueStatus.active_counters}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                    Currently In Service
                  </span>
                  <div className="text-2xl font-black text-amber-600">
                    {queueStatus.queue_state.in_service_count}
                  </div>
                </div>
              </div>

              {/* Wait Estimate Display */}
              <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900">Deterministic Wait Projection</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {queueStatus.estimated_wait.model_version}
                    </span>
                  </div>

                  {queueStatus.estimated_wait.confidence && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-500">Confidence:</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          queueStatus.estimated_wait.confidence === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : queueStatus.estimated_wait.confidence === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {queueStatus.estimated_wait.confidence}
                      </span>
                    </div>
                  )}
                </div>

                {queueStatus.estimated_wait.is_available ? (
                  <div className="space-y-3">
                    <div className="flex items-baseline space-x-3">
                      <span className="text-3xl font-black text-slate-900">
                        {queueStatus.estimated_wait.lower_minutes}&ndash;{queueStatus.estimated_wait.upper_minutes}
                      </span>
                      <span className="text-base font-semibold text-slate-600">minutes</span>
                      {queueStatus.estimated_wait.expected_minutes !== null && (
                        <span className="text-xs text-slate-500">
                          (expected ~{queueStatus.estimated_wait.expected_minutes} mins)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>
                        <strong>Sample Size:</strong> {queueStatus.estimated_wait.sample_size} completed sessions
                      </span>
                      {queueStatus.estimated_wait.freshness_seconds !== null &&
                        queueStatus.estimated_wait.freshness_seconds !== undefined && (
                          <span>
                            <strong>Signal Freshness:</strong>{' '}
                            {queueStatus.estimated_wait.freshness_seconds < 60
                              ? 'Just now (< 1m)'
                              : `${Math.round(queueStatus.estimated_wait.freshness_seconds / 60)}m ago`}
                          </span>
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <div className="font-bold flex items-center space-x-2 mb-1">
                      <span>Estimate Unavailable</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      {queueStatus.estimated_wait.reason || 'Insufficient data to compute a trustworthy wait projection.'}
                    </p>
                    <p className="text-[11px] text-amber-600 mt-2">
                      QueueLess Bharat never presents fabricated estimates or false 0-minute predictions when empirical data is unavailable.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : queueError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <strong>Error loading queue:</strong> {queueError}
            </div>
          ) : null}
        </div>

        {/* Backend Health & Readiness Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Backend Health & Readiness</h2>
              <p className="text-sm text-slate-500">
                Connection verification with the modular monolith API and PostgreSQL.
              </p>
            </div>
            <button
              onClick={checkHealth}
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
              <strong>Connection Error:</strong> {healthError}. Ensure backend is running at{' '}
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
            <h3 className="font-bold text-slate-900 mb-2">Deterministic Queue Engine V1</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Little&apos;s Law throughput calculation, IQR outlier rejection, bounded uncertainty intervals,
              and deterministic confidence classification without stochastic AI dependency.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-2">PostgreSQL Relational Domain</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              ACID transactional storage for Locations, Services, Counters, Queue Sessions, and append-only
              Queue Events with idempotency deduplication.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-slate-400">
          QueueLess Bharat &mdash; Milestone 2 Domain &amp; Deterministic Engine
        </div>
      </footer>
    </div>
  )
}

export default App
