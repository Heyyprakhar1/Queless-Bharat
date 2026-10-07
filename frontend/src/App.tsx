import { useEffect, useState } from 'react'
import { fetchHealth } from './api/health'
import {
  cancelQueueSession,
  checkInQueue,
  completeService,
  fetchQueueStatus,
  fetchServices,
  fetchUserQueueStatus,
  startService,
} from './api/queue'
import type { HealthResponse } from './types/health'
import type { QueueStatusResponse, Service, UserQueueStatusResponse } from './types/queue'

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState<boolean>(true)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Catalog state
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null)
  const [queueLoading, setQueueLoading] = useState<boolean>(false)
  const [queueError, setQueueError] = useState<string | null>(null)

  // Citizen interactive flow state
  const [citizenName, setCitizenName] = useState<string>('')
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem('queless_active_session_id') || ''
  })
  const [userStatus, setUserStatus] = useState<UserQueueStatusResponse | null>(null)
  const [citizenLoading, setCitizenLoading] = useState<boolean>(false)
  const [citizenError, setCitizenError] = useState<string | null>(null)
  const [operatorMessage, setOperatorMessage] = useState<string | null>(null)

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
      // Catalog might be empty initially
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

  const loadUserStatus = async (sessionId: string) => {
    if (!sessionId) return
    try {
      const status = await fetchUserQueueStatus(sessionId)
      setUserStatus(status)
      setCitizenError(null)
    } catch (err) {
      setCitizenError(err instanceof Error ? err.message : 'Failed to fetch ticket status')
    }
  }

  // Handle Join Queue
  const handleJoinQueue = async () => {
    if (!selectedServiceId) return
    setCitizenLoading(true)
    setCitizenError(null)
    setOperatorMessage(null)
    try {
      const idempotencyKey = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const session = await checkInQueue(
        selectedServiceId,
        citizenName.trim() || undefined,
        idempotencyKey
      )
      setActiveSessionId(session.id)
      localStorage.setItem('queless_active_session_id', session.id)
      await loadUserStatus(session.id)
      await loadQueueStatus(selectedServiceId)
    } catch (err) {
      setCitizenError(err instanceof Error ? err.message : 'Failed to join queue')
    } finally {
      setCitizenLoading(false)
    }
  }

  // Handle Cancel Ticket
  const handleCancelTicket = async () => {
    if (!activeSessionId) return
    setCitizenLoading(true)
    try {
      await cancelQueueSession(activeSessionId, 'Citizen cancelled via web portal')
      await loadUserStatus(activeSessionId)
      if (selectedServiceId) {
        await loadQueueStatus(selectedServiceId)
      }
    } catch (err) {
      setCitizenError(err instanceof Error ? err.message : 'Failed to cancel session')
    } finally {
      setCitizenLoading(false)
    }
  }

  // Handle Clear / Dismiss Finished Ticket
  const handleDismissTicket = () => {
    setActiveSessionId('')
    setUserStatus(null)
    localStorage.removeItem('queless_active_session_id')
    setOperatorMessage(null)
  }

  // Operator Desk Simulation Actions
  const handleOperatorStart = async () => {
    if (!activeSessionId) return
    setCitizenLoading(true)
    setOperatorMessage(null)
    try {
      await startService(activeSessionId)
      setOperatorMessage('Participant moved into service at counter.')
      await loadUserStatus(activeSessionId)
      if (selectedServiceId) {
        await loadQueueStatus(selectedServiceId)
      }
    } catch (err) {
      setOperatorMessage(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCitizenLoading(false)
    }
  }

  const handleOperatorComplete = async () => {
    if (!activeSessionId) return
    setCitizenLoading(true)
    setOperatorMessage(null)
    try {
      await completeService(activeSessionId)
      setOperatorMessage('Service marked completed! Observation recorded for wait estimator.')
      await loadUserStatus(activeSessionId)
      if (selectedServiceId) {
        await loadQueueStatus(selectedServiceId)
      }
    } catch (err) {
      setOperatorMessage(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCitizenLoading(false)
    }
  }

  // Initial load and health polling (ADR-0005: 30s interval)
  useEffect(() => {
    checkHealth()
    loadCatalog()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Poll selected service queue status (15s interval)
  useEffect(() => {
    if (selectedServiceId) {
      loadQueueStatus(selectedServiceId)
      const queueInterval = setInterval(() => {
        loadQueueStatus(selectedServiceId)
      }, 15000)
      return () => clearInterval(queueInterval)
    }
  }, [selectedServiceId])

  // Poll active user ticket status (5s interval for live responsiveness)
  useEffect(() => {
    if (activeSessionId) {
      loadUserStatus(activeSessionId)
      const ticketInterval = setInterval(() => {
        loadUserStatus(activeSessionId)
      }, 5000)
      return () => clearInterval(ticketInterval)
    }
  }, [activeSessionId])

  const isHealthy = health?.status === 'ok' && health?.database === 'connected'
  const isTerminalTicket =
    userStatus?.session.status === 'COMPLETED' || userStatus?.session.status === 'CANCELLED'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
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
                Milestone 3 Production Flow
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span>{isHealthy ? 'System Online' : 'System Offline'}</span>
            </div>
            <a
              href="https://github.com/Heyyprakhar1/Queless-Bharat"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 hover:text-slate-800 transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            Predictable Waiting for Public Services
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            <em>&ldquo;Making waiting more predictable, not pretending queues don&apos;t exist.&rdquo;</em>
          </p>
        </div>

        {/* SECTION 1: CITIZEN ACTIVE TICKET OR JOIN FORM */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Citizen Digital Token Desk</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Join an active public queue and track your live position &amp; wait time.
              </p>
            </div>
            {activeSessionId && (
              <span className="text-xs font-mono px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200">
                Token: {activeSessionId.slice(0, 8)}...
              </span>
            )}
          </div>

          {citizenError && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
              <strong>Error:</strong> {citizenError}
            </div>
          )}

          {!activeSessionId ? (
            /* Join Queue Form */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="facility-service" className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Public Service
                  </label>
                  <select
                    id="facility-service"
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={services.length === 0}
                  >
                    {services.length === 0 ? (
                      <option value="">No services available</option>
                    ) : (
                      services.map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="citizen-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Citizen Identifier / Name (Optional)
                  </label>
                  <input
                    id="citizen-name"
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    placeholder="e.g. Citizen Rahul"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleJoinQueue}
                  disabled={citizenLoading || services.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {citizenLoading ? 'Issuing Token...' : 'Join Queue / Issue Token'}
                </button>
              </div>
            </div>
          ) : userStatus ? (
            /* Active Live Ticket Display */
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                      {userStatus.service.name}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      {userStatus.session.user_id ? userStatus.session.user_id : 'Citizen Ticket'}
                    </h3>
                    <p className="text-xs font-mono text-slate-500">
                      Session ID: {userStatus.session.id}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {userStatus.session.status === 'WAITING' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse" />
                        WAITING IN LINE
                      </span>
                    )}
                    {userStatus.session.status === 'IN_SERVICE' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-ping" />
                        NOW AT COUNTER (IN SERVICE)
                      </span>
                    )}
                    {userStatus.session.status === 'COMPLETED' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                        COMPLETED
                      </span>
                    )}
                    {userStatus.session.status === 'CANCELLED' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        CANCELLED
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Position & People Ahead Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-semibold">
                      Your Position
                    </span>
                    <div className="text-3xl font-black text-indigo-600 mt-1">
                      {userStatus.position !== null ? `#${userStatus.position}` : '—'}
                    </div>
                    <span className="text-xs text-slate-500">
                      {userStatus.session.status === 'WAITING'
                        ? 'in queue line'
                        : userStatus.session.status === 'IN_SERVICE'
                          ? 'currently being served'
                          : 'lifecycle completed'}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-semibold">
                      People Ahead of You
                    </span>
                    <div className="text-3xl font-black text-slate-800 mt-1">
                      {userStatus.people_ahead}
                    </div>
                    <span className="text-xs text-slate-500">
                      {userStatus.people_ahead === 0 && userStatus.session.status === 'WAITING'
                        ? "You're next in line!"
                        : 'waiting participants ahead'}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-semibold">
                      Personal Wait Estimate
                    </span>
                    <div className="mt-1">
                      {userStatus.estimated_wait.is_available ? (
                        <>
                          <div className="text-2xl font-black text-slate-900">
                            {userStatus.estimated_wait.lower_minutes}&ndash;
                            {userStatus.estimated_wait.upper_minutes}{' '}
                            <span className="text-sm font-normal text-slate-600">mins</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            Expected: ~{userStatus.estimated_wait.expected_minutes} mins
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-amber-700">
                            Estimating...
                          </div>
                          <span className="text-xs text-slate-500">
                            {userStatus.estimated_wait.reason || 'Data baseline accumulating'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Polling indication and actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-indigo-100 text-xs">
                  <div className="text-slate-500 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Auto-updating via HTTP short polling (5s interval)</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {!isTerminalTicket ? (
                      <button
                        onClick={handleCancelTicket}
                        disabled={citizenLoading}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium transition cursor-pointer"
                      >
                        Leave Queue / Cancel
                      </button>
                    ) : (
                      <button
                        onClick={handleDismissTicket}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition cursor-pointer"
                      >
                        Take New Token
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* DEMO OPERATOR DESK SIMULATOR (for testing and advancing ticket lifecycle) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Counter Operator Desk (Demo Simulator)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Advance this ticket through the state machine
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleOperatorStart}
                    disabled={citizenLoading || userStatus.session.status !== 'WAITING'}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    Call into Service (Start)
                  </button>
                  <button
                    onClick={handleOperatorComplete}
                    disabled={citizenLoading || userStatus.session.status !== 'IN_SERVICE'}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    Finish Service (Complete)
                  </button>
                  <button
                    onClick={() => loadUserStatus(activeSessionId)}
                    disabled={citizenLoading}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Manual Refresh
                  </button>
                </div>

                {operatorMessage && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">{operatorMessage}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">
              Loading digital token details...
            </div>
          )}
        </div>

        {/* SECTION 2: QUEUE INTELLIGENCE MONITOR (AGGREGATE SERVICE MONITOR) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Queue Intelligence Monitor</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Facility-wide queue state and pure mathematical wait estimation (ADR-0003).
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
                    Waiting in Line
                  </span>
                  <div className="text-2xl font-black text-indigo-600">
                    {queueStatus.queue_state.waiting_count}
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

        {/* SECTION 3: BACKEND HEALTH & READINESS PANEL */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Backend Health &amp; Readiness</h2>
              <p className="text-xs sm:text-sm text-slate-500">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-slate-400">
          QueueLess Bharat &mdash; Milestone 3 Production Hardening &amp; Interactive Flow
        </div>
      </footer>
    </div>
  )
}

export default App
