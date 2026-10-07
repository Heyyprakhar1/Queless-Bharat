import { useEffect, useState } from 'react'
import type React from 'react'
import {
  clearAuthSession,
  getAuthToken,
  getMe,
  getStoredUser,
  login,
  logout,
  register,
} from './api/auth'
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
import type { User, UserRole } from './types/auth'
import type { HealthResponse } from './types/health'
import type { QueueStatusResponse, Service, UserQueueStatusResponse } from './types/queue'

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState<boolean>(true)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser())
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState<string>('')
  const [authPassword, setAuthPassword] = useState<string>('')
  const [authFullName, setAuthFullName] = useState<string>('')
  const [authRole, setAuthRole] = useState<UserRole>('CITIZEN')
  const [authLoading, setAuthLoading] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

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
  const [operatorIsError, setOperatorIsError] = useState<boolean>(false)

  // Validate session on load
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      getMe()
        .then((user) => {
          setCurrentUser(user)
        })
        .catch(() => {
          clearAuthSession()
          setCurrentUser(null)
        })
    }
  }, [])

  // Sync citizen name when user changes
  useEffect(() => {
    if (currentUser?.full_name && !citizenName) {
      setCitizenName(currentUser.full_name)
    }
  }, [currentUser, citizenName])

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

  // Auth handlers
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const resp = await login({ email: authEmail, password: authPassword })
      setCurrentUser(resp.user)
      setShowAuthModal(false)
      setAuthPassword('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const resp = await register({
        email: authEmail,
        password: authPassword,
        full_name: authFullName,
        role: authRole,
      })
      setCurrentUser(resp.user)
      setShowAuthModal(false)
      setAuthPassword('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleQuickLogin = async (email: string, pass: string) => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const resp = await login({ email, password: pass })
      setCurrentUser(resp.user)
      setShowAuthModal(false)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setCurrentUser(null)
    setCitizenError(null)
    setOperatorMessage(null)
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

  // Operator Desk Actions
  const handleOperatorStart = async () => {
    if (!activeSessionId) return
    setCitizenLoading(true)
    setOperatorMessage(null)
    setOperatorIsError(false)
    try {
      await startService(activeSessionId)
      setOperatorMessage('Participant moved into service at counter.')
      setOperatorIsError(false)
      await loadUserStatus(activeSessionId)
      if (selectedServiceId) {
        await loadQueueStatus(selectedServiceId)
      }
    } catch (err) {
      setOperatorIsError(true)
      setOperatorMessage(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCitizenLoading(false)
    }
  }

  const handleOperatorComplete = async () => {
    if (!activeSessionId) return
    setCitizenLoading(true)
    setOperatorMessage(null)
    setOperatorIsError(false)
    try {
      await completeService(activeSessionId)
      setOperatorMessage('Service marked completed! Observation recorded for wait estimator.')
      setOperatorIsError(false)
      await loadUserStatus(activeSessionId)
      if (selectedServiceId) {
        await loadQueueStatus(selectedServiceId)
      }
    } catch (err) {
      setOperatorIsError(true)
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

  const isOperatorOrAdmin = currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              Q
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                QueueLess Bharat
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Milestone 4 Auth &amp; RBAC
              </span>
            </div>
          </div>

          {/* User Auth Section in Header */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 mr-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span>{isHealthy ? 'System Online' : 'System Offline'}</span>
            </div>

            {currentUser ? (
              <div className="flex items-center space-x-2 bg-slate-100 py-1 px-3 rounded-lg border border-slate-200">
                <span id="auth-user-badge" className="text-xs font-medium text-slate-800">
                  {currentUser.full_name || currentUser.email}
                </span>
                <span
                  id="auth-role-badge"
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-amber-200 text-amber-900'
                      : currentUser.role === 'OPERATOR'
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-blue-200 text-blue-900'
                  }`}
                >
                  {currentUser.role}
                </span>
                <button
                  id="btn-logout"
                  onClick={handleLogout}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 ml-2 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  id="btn-open-auth"
                  onClick={() => {
                    setAuthMode('login')
                    setShowAuthModal(true)
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition cursor-pointer"
                >
                  Sign In
                </button>
                <div className="hidden sm:flex items-center space-x-1 text-xs">
                  <span className="text-slate-400">| Quick:</span>
                  <button
                    id="btn-demo-citizen"
                    onClick={() => handleQuickLogin('citizen@queless.gov.in', 'CitizenPass123!')}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                  >
                    Citizen
                  </button>
                  <button
                    id="btn-demo-operator"
                    onClick={() => handleQuickLogin('operator@queless.gov.in', 'OperatorPass123!')}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                  >
                    Operator
                  </button>
                  <button
                    id="btn-demo-admin"
                    onClick={() => handleQuickLogin('admin@queless.gov.in', 'AdminPass123!')}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                  >
                    Admin
                  </button>
                </div>
              </div>
            )}
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
            <div id="citizen-error-msg" className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
              <strong>Error:</strong> {citizenError}
            </div>
          )}

          {!currentUser && (
            <div className="p-3 mb-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs sm:text-sm flex items-center justify-between">
              <span>Sign in as a Citizen or select a Quick Demo role to issue verified queue tokens.</span>
              <button
                onClick={() => handleQuickLogin('citizen@queless.gov.in', 'CitizenPass123!')}
                className="font-bold underline ml-2 cursor-pointer"
              >
                Sign In as Citizen
              </button>
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
                    Citizen Identifier / Name
                  </label>
                  <input
                    id="citizen-name"
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    placeholder="e.g. Citizen Amit Sharma"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="btn-join-queue"
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

              {/* OPERATOR DESK SIMULATOR (RBAC ENFORCED) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Counter Operator Desk (Staff Controls)
                    </span>
                    <span
                      id="operator-role-indicator"
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isOperatorOrAdmin
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {isOperatorOrAdmin
                        ? `Authorized (${currentUser?.role})`
                        : `Staff Restricted (Role: ${currentUser?.role || 'Unauthenticated'})`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Advances ticket state (Requires OPERATOR or ADMIN role)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    id="btn-operator-start"
                    onClick={handleOperatorStart}
                    disabled={citizenLoading || userStatus.session.status !== 'WAITING'}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    Call into Service (Start)
                  </button>
                  <button
                    id="btn-operator-complete"
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
                  <div
                    id="operator-message"
                    className={`mt-3 p-2.5 rounded-lg text-xs font-medium border ${
                      operatorIsError
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {operatorMessage}
                  </div>
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
              <code>http://localhost:8001</code>.
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

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex space-x-3">
                <button
                  id="tab-login"
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthError(null)
                  }}
                  className={`text-sm font-bold pb-1 cursor-pointer transition ${
                    authMode === 'login'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="tab-register"
                  type="button"
                  onClick={() => {
                    setAuthMode('register')
                    setAuthError(null)
                  }}
                  className={`text-sm font-bold pb-1 cursor-pointer transition ${
                    authMode === 'register'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Create Account
                </button>
              </div>
              <button
                id="btn-close-modal"
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {authError && (
              <div id="auth-error-msg" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <strong>Authentication error:</strong> {authError}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="input-login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="input-login-email"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="input-login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    id="input-login-password"
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  id="btn-submit-login"
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="pt-2 border-t border-slate-100 text-center">
                  <span className="text-[11px] text-slate-400 block mb-2">Or select a demo account:</span>
                  <div className="flex flex-col gap-1.5">
                    <button
                      id="btn-modal-demo-citizen"
                      type="button"
                      onClick={() => handleQuickLogin('citizen@queless.gov.in', 'CitizenPass123!')}
                      className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer text-left flex justify-between items-center"
                    >
                      <span>Citizen (Amit Sharma)</span>
                      <span className="text-[10px] text-slate-400 font-mono">citizen@queless.gov.in</span>
                    </button>
                    <button
                      id="btn-modal-demo-operator"
                      type="button"
                      onClick={() => handleQuickLogin('operator@queless.gov.in', 'OperatorPass123!')}
                      className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer text-left flex justify-between items-center"
                    >
                      <span>Operator (Rajesh)</span>
                      <span className="text-[10px] text-slate-400 font-mono">operator@queless.gov.in</span>
                    </button>
                    <button
                      id="btn-modal-demo-admin"
                      type="button"
                      onClick={() => handleQuickLogin('admin@queless.gov.in', 'AdminPass123!')}
                      className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer text-left flex justify-between items-center"
                    >
                      <span>System Admin</span>
                      <span className="text-[10px] text-slate-400 font-mono">admin@queless.gov.in</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label htmlFor="input-register-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="input-register-name"
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="e.g. Priya Patel"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="input-register-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="input-register-email"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="priya@example.com"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="input-register-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Password (min 8 chars)
                  </label>
                  <input
                    id="input-register-password"
                    type="password"
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="select-register-role" className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Role
                  </label>
                  <select
                    id="select-register-role"
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value as UserRole)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CITIZEN">CITIZEN (Public queue participant)</option>
                    <option value="OPERATOR">OPERATOR (Desk counter staff)</option>
                    <option value="ADMIN">ADMIN (System administrator)</option>
                  </select>
                </div>

                <button
                  id="btn-submit-register"
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-slate-400">
          QueueLess Bharat &mdash; Milestone 4 Authentication &amp; RBAC Authorization
        </div>
      </footer>
    </div>
  )
}

export default App
