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
  fetchCities,
  fetchLocations,
  fetchQueueStatus,
  fetchServices,
  fetchUserQueueStatus,
  startService,
} from './api/queue'
import type { User, UserRole } from './types/auth'
import type { HealthResponse } from './types/health'
import type {
  Location,
  QueueStatusResponse,
  Service,
  UserQueueStatusResponse,
} from './types/queue'

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

  // M6.1 India Demo Explorer state
  const [cities, setCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('Pune')
  const [facilities, setFacilities] = useState<Location[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [facilityServices, setFacilityServices] = useState<Service[]>([])
  const [selectedDemoServiceId, setSelectedDemoServiceId] = useState<string>('')
  const [demoQueueStatus, setDemoQueueStatus] = useState<QueueStatusResponse | null>(null)
  const [demoQueueLoading, setDemoQueueLoading] = useState<boolean>(false)
  const [demoQueueError, setDemoQueueError] = useState<string | null>(null)

  // Citizen interactive flow state
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
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

  // Load all services for backward-compatible citizen dropdown
  const loadGlobalCatalog = async () => {
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

  // Load cities on mount
  useEffect(() => {
    async function initCities() {
      try {
        const cityList = await fetchCities()
        setCities(cityList)
        if (cityList.length > 0) {
          // Default to Pune as showcase city if available, else first city
          if (cityList.includes('Pune')) {
            setSelectedCity('Pune')
          } else {
            setSelectedCity(cityList[0])
          }
        }
      } catch {
        // Fallback default cities if API not ready
        setCities(['Pune', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Delhi', 'Lucknow', 'Patna'])
      }
    }
    initCities()
    checkHealth()
    loadGlobalCatalog()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load facilities when selected city changes
  useEffect(() => {
    if (!selectedCity) return
    let isCancelled = false
    async function loadFacilitiesForCity() {
      try {
        const locs = await fetchLocations(selectedCity)
        if (!isCancelled) {
          setFacilities(locs)
          if (locs.length > 0) {
            setSelectedFacilityId(locs[0].id)
          } else {
            setSelectedFacilityId('')
            setFacilityServices([])
            setSelectedDemoServiceId('')
            setDemoQueueStatus(null)
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setDemoQueueError(err instanceof Error ? err.message : 'Failed to load facilities')
        }
      }
    }
    loadFacilitiesForCity()
    return () => {
      isCancelled = true
    }
  }, [selectedCity])

  // Load services when selected facility changes
  useEffect(() => {
    if (!selectedFacilityId) return
    let isCancelled = false
    async function loadServicesForFacility() {
      try {
        const svcs = await fetchServices(selectedFacilityId)
        if (!isCancelled) {
          setFacilityServices(svcs)
          if (svcs.length > 0) {
            setSelectedDemoServiceId(svcs[0].id)
          } else {
            setSelectedDemoServiceId('')
            setDemoQueueStatus(null)
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setDemoQueueError(err instanceof Error ? err.message : 'Failed to load services')
        }
      }
    }
    loadServicesForFacility()
    return () => {
      isCancelled = true
    }
  }, [selectedFacilityId])

  // Load queue status when selected demo service changes
  const loadDemoQueueStatus = async (serviceId: string) => {
    if (!serviceId) return
    setDemoQueueLoading(true)
    setDemoQueueError(null)
    try {
      const status = await fetchQueueStatus(serviceId)
      setDemoQueueStatus(status)
    } catch (err) {
      setDemoQueueError(err instanceof Error ? err.message : 'Failed to fetch queue status')
      setDemoQueueStatus(null)
    } finally {
      setDemoQueueLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDemoServiceId) {
      loadDemoQueueStatus(selectedDemoServiceId)
      const queueInterval = setInterval(() => {
        loadDemoQueueStatus(selectedDemoServiceId)
      }, 15000)
      return () => clearInterval(queueInterval)
    }
  }, [selectedDemoServiceId])

  // User Ticket Status Poll
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

  useEffect(() => {
    if (activeSessionId) {
      loadUserStatus(activeSessionId)
      const ticketInterval = setInterval(() => {
        loadUserStatus(activeSessionId)
      }, 5000)
      return () => clearInterval(ticketInterval)
    }
  }, [activeSessionId])

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
    const targetServiceId = selectedServiceId || selectedDemoServiceId
    if (!targetServiceId) return
    setCitizenLoading(true)
    setCitizenError(null)
    setOperatorMessage(null)
    try {
      const idempotencyKey = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const session = await checkInQueue(
        targetServiceId,
        citizenName.trim() || undefined,
        idempotencyKey
      )
      setActiveSessionId(session.id)
      localStorage.setItem('queless_active_session_id', session.id)
      await loadUserStatus(session.id)
      if (selectedDemoServiceId) {
        await loadDemoQueueStatus(selectedDemoServiceId)
      }
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
      if (selectedDemoServiceId) {
        await loadDemoQueueStatus(selectedDemoServiceId)
      }
    } catch (err) {
      setCitizenError(err instanceof Error ? err.message : 'Failed to cancel session')
    } finally {
      setCitizenLoading(false)
    }
  }

  // Dismiss finished ticket
  const handleDismissTicket = () => {
    setActiveSessionId('')
    setUserStatus(null)
    localStorage.removeItem('queless_active_session_id')
    setOperatorMessage(null)
  }

  // Operator actions
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
      if (selectedDemoServiceId) {
        await loadDemoQueueStatus(selectedDemoServiceId)
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
      if (selectedDemoServiceId) {
        await loadDemoQueueStatus(selectedDemoServiceId)
      }
    } catch (err) {
      setOperatorIsError(true)
      setOperatorMessage(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCitizenLoading(false)
    }
  }

  const isHealthy = health?.status === 'ok' && health?.database === 'connected'
  const isTerminalTicket =
    userStatus?.session.status === 'COMPLETED' || userStatus?.session.status === 'CANCELLED'
  const isOperatorOrAdmin = currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN'

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId)
  const selectedDemoService = facilityServices.find((s) => s.id === selectedDemoServiceId)

  // Initial 8 cities list for pill bar
  const displayCities = [
    'Pune',
    'Mumbai',
    'Bengaluru',
    'Chennai',
    'Kolkata',
    'Delhi',
    'Lucknow',
    'Patna',
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-xs">
              Q
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  QueueLess Bharat
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  M6.1 India Demo
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Deterministic Waiting for Indian Civic Services
              </p>
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
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Predictable Waiting for Public Services Across India
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl mx-auto">
            <em>&ldquo;Making waiting more predictable, not pretending queues don&apos;t exist.&rdquo;</em>
          </p>

          {/* Simulation Disclaimer Alert Banner */}
          <div
            id="simulation-notice-banner"
            className="mt-4 p-3.5 max-w-3xl mx-auto rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-center space-x-2 text-center"
          >
            <span className="font-extrabold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] tracking-wider uppercase">
              SIMULATED DEMO DATA
            </span>
            <span>
              All queue sizes, active counters, and throughput sessions shown are <strong>DEMO / SIMULATED DATA</strong> for mathematical algorithmic evaluation. Not live facility telemetry.
            </span>
          </div>
        </div>

        {/* SECTION 1: M6.1 INDIA CIVIC QUEUE EXPLORER (CITY -> FACILITY -> SERVICE -> ESTIMATE) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900">
                  India Civic Queue Explorer
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  City &rarr; Facility &rarr; Service Flow
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Select an Indian city, public institution, and counter service to inspect deterministic wait projections.
              </p>
            </div>

            {/* Simulated Data Badge */}
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-900 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>DEMO / SIMULATED DATA</span>
            </div>
          </div>

          {/* City Quick Pills Bar */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Select City (8 Major Metros)
            </label>
            <div className="flex flex-wrap gap-2">
              {displayCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedCity(city)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                    selectedCity === city
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{city}</span>
                  {city === 'Pune' && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        selectedCity === 'Pune'
                          ? 'bg-indigo-800 text-amber-300'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Showcase
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cascading Selectors: City, Facility, Service */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label htmlFor="city-select" className="block text-xs font-bold text-slate-700 mb-1">
                1. City
              </label>
              <select
                id="city-select"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c} {c === 'Pune' ? '(Showcase City)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="facility-select" className="block text-xs font-bold text-slate-700 mb-1">
                2. Facility / Institution
              </label>
              <select
                id="facility-select"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                disabled={facilities.length === 0}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {facilities.length === 0 ? (
                  <option value="">No facilities found</option>
                ) : (
                  facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} [{fac.category.toUpperCase()}]
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor="service-select" className="block text-xs font-bold text-slate-700 mb-1">
                3. Civic Service Window
              </label>
              <select
                id="service-select"
                value={selectedDemoServiceId}
                onChange={(e) => setSelectedDemoServiceId(e.target.value)}
                disabled={facilityServices.length === 0}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {facilityServices.length === 0 ? (
                  <option value="">No services registered</option>
                ) : (
                  facilityServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Facility Location Details Banner */}
          {selectedFacility && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800">{selectedFacility.name}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span>{selectedFacility.address}</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase font-sans font-bold">
                  {selectedFacility.category}
                </span>
                {selectedFacility.latitude && selectedFacility.longitude && (
                  <span>
                    GPS: {selectedFacility.latitude.toFixed(4)}°N, {selectedFacility.longitude.toFixed(4)}°E
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Queue Status & Wait Projection Display */}
          {demoQueueLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading deterministic wait estimate...
            </div>
          ) : demoQueueStatus ? (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    People Ahead in Line
                  </span>
                  <div id="demo-people-ahead" className="text-2xl font-black text-indigo-600">
                    {demoQueueStatus.people_ahead}
                  </div>
                  <span className="text-[11px] text-slate-500">waiting tokens</span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Active Counters
                  </span>
                  <div id="demo-active-counters" className="text-2xl font-black text-emerald-600">
                    {demoQueueStatus.active_counters}
                  </div>
                  <span className="text-[11px] text-slate-500">open service windows</span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Currently in Service
                  </span>
                  <div id="demo-in-service" className="text-2xl font-black text-amber-600">
                    {demoQueueStatus.queue_state.in_service_count}
                  </div>
                  <span className="text-[11px] text-slate-500">participants being served</span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Data Mode
                  </span>
                  <div className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded inline-block mt-1">
                    SIMULATED
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Mathematical benchmark</span>
                </div>
              </div>

              {/* Deterministic Wait Projection Card */}
              <div
                id="demo-wait-projection"
                className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900">
                      Deterministic Wait Projection (ADR-0003)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {demoQueueStatus.estimated_wait.model_version}
                    </span>
                  </div>

                  {demoQueueStatus.estimated_wait.confidence && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-500">Confidence Rating:</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          demoQueueStatus.estimated_wait.confidence === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : demoQueueStatus.estimated_wait.confidence === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {demoQueueStatus.estimated_wait.confidence}
                      </span>
                    </div>
                  )}
                </div>

                {demoQueueStatus.estimated_wait.is_available ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <div className="text-3xl sm:text-4xl font-black text-slate-900">
                        {demoQueueStatus.estimated_wait.lower_minutes}&ndash;
                        {demoQueueStatus.estimated_wait.upper_minutes}{' '}
                        <span className="text-base sm:text-lg font-normal text-slate-600">minutes</span>
                      </div>
                      {demoQueueStatus.estimated_wait.expected_minutes !== null && (
                        <div className="text-sm font-semibold text-slate-600">
                          (expected ~{demoQueueStatus.estimated_wait.expected_minutes} mins)
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                      <span>
                        <strong>Sample Baseline:</strong> {demoQueueStatus.estimated_wait.sample_size} completed throughput sessions
                      </span>
                      {demoQueueStatus.estimated_wait.freshness_seconds !== null &&
                        demoQueueStatus.estimated_wait.freshness_seconds !== undefined && (
                          <span>
                            <strong>Signal Freshness:</strong>{' '}
                            {demoQueueStatus.estimated_wait.freshness_seconds < 60
                              ? 'Just now (< 1m)'
                              : `${Math.round(demoQueueStatus.estimated_wait.freshness_seconds / 60)}m ago`}
                          </span>
                        )}
                      {demoQueueStatus.estimated_wait.supporting_signals?.service_rate_per_hour !== undefined && (
                        <span>
                          <strong>Service Rate:</strong> ~{String(demoQueueStatus.estimated_wait.supporting_signals.service_rate_per_hour)}/hr
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div id="demo-unavailable-msg" className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
                    <div className="font-bold flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>Estimate Unavailable</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      {demoQueueStatus.estimated_wait.reason ||
                        'Insufficient empirical sample data to derive a confident wait projection.'}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      QueueLess Bharat strictly adheres to ADR-0003: it never fabricates false wait estimates or reports false 0-minute wait times when operational data is insufficient.
                    </p>
                  </div>
                )}
              </div>

              {/* Action to test this service in the Citizen Token Desk */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Ready to test queue session lifecycle for this service?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(selectedDemoServiceId)
                    window.scrollTo({ top: 800, behavior: 'smooth' })
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer border border-indigo-200"
                >
                  Issue Token for &ldquo;{selectedDemoService?.name}&rdquo; &darr;
                </button>
              </div>
            </div>
          ) : demoQueueError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <strong>Error loading queue scenario:</strong> {demoQueueError}
            </div>
          ) : null}
        </div>

        {/* SECTION 2: CITIZEN DIGITAL TOKEN DESK (LIFECYCLE & OPERATOR CONTROLS) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Citizen Digital Token Desk</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Join an active civic queue and track your position, token, &amp; wait time.
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
                  disabled={citizenLoading || (services.length === 0 && !selectedDemoServiceId)}
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

              {/* OPERATOR DESK (RBAC ENFORCED) */}
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
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-slate-400 space-y-1">
          <div>QueueLess Bharat &mdash; M6.1 India Demo Coverage</div>
          <div className="text-[11px] text-slate-400">
            Showcase Cities: Pune, Mumbai, Bengaluru, Chennai, Kolkata, Delhi, Lucknow, Patna &bull; Pure Deterministic Queue Engine
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
