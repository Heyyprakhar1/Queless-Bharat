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
import {
  AuthModal,
  CitizenTokenDesk,
  Footer,
  Header,
  HealthPanel,
  IndiaDemoExplorer,
  OperatorDesk,
} from './components'
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
  const [cities, setCities] = useState<string[]>([
    'Pune',
    'Mumbai',
    'Bengaluru',
    'Chennai',
    'Kolkata',
    'Delhi',
    'Lucknow',
    'Patna',
  ])
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
        if (cityList.length > 0) {
          setCities(cityList)
          setSelectedCity((prev) =>
            prev && cityList.includes(prev) ? prev : cityList.includes('Pune') ? 'Pune' : cityList[0]
          )
        }
      } catch {
        // Fallback default cities already pre-initialized
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <Header
        isHealthy={isHealthy}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => {
          setAuthMode('login')
          setShowAuthModal(true)
        }}
        onQuickLogin={handleQuickLogin}
      />

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
        <IndiaDemoExplorer
          cities={cities}
          selectedCity={selectedCity}
          onSelectCity={setSelectedCity}
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={setSelectedFacilityId}
          facilityServices={facilityServices}
          selectedDemoServiceId={selectedDemoServiceId}
          onSelectDemoService={setSelectedDemoServiceId}
          demoQueueStatus={demoQueueStatus}
          demoQueueLoading={demoQueueLoading}
          demoQueueError={demoQueueError}
          onTestServiceInTokenDesk={(serviceId) => {
            setSelectedServiceId(serviceId)
            window.scrollTo({ top: 800, behavior: 'smooth' })
          }}
        />

        {/* SECTION 2: CITIZEN DIGITAL TOKEN DESK (LIFECYCLE & OPERATOR CONTROLS) */}
        <CitizenTokenDesk
          currentUser={currentUser}
          services={services}
          selectedServiceId={selectedServiceId}
          onSelectService={setSelectedServiceId}
          citizenName={citizenName}
          onChangeCitizenName={setCitizenName}
          activeSessionId={activeSessionId}
          userStatus={userStatus}
          citizenLoading={citizenLoading}
          citizenError={citizenError}
          selectedDemoServiceId={selectedDemoServiceId}
          onJoinQueue={handleJoinQueue}
          onCancelTicket={handleCancelTicket}
          onDismissTicket={handleDismissTicket}
          onQuickLogin={handleQuickLogin}
        >
          {activeSessionId && userStatus && (
            <OperatorDesk
              currentUser={currentUser}
              userStatus={userStatus}
              citizenLoading={citizenLoading}
              operatorMessage={operatorMessage}
              operatorIsError={operatorIsError}
              onStartService={handleOperatorStart}
              onCompleteService={handleOperatorComplete}
              onRefreshStatus={() => loadUserStatus(activeSessionId)}
            />
          )}
        </CitizenTokenDesk>

        {/* SECTION 3: BACKEND HEALTH & READINESS PANEL */}
        <HealthPanel
          health={health}
          healthLoading={healthLoading}
          healthError={healthError}
          lastChecked={lastChecked}
          onCheckHealth={checkHealth}
        />
      </main>

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={showAuthModal}
        mode={authMode}
        onClose={() => setShowAuthModal(false)}
        onModeChange={(mode) => {
          setAuthMode(mode)
          setAuthError(null)
        }}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authFullName={authFullName}
        setAuthFullName={setAuthFullName}
        authRole={authRole}
        setAuthRole={setAuthRole}
        authLoading={authLoading}
        authError={authError}
        onSubmitLogin={handleLoginSubmit}
        onSubmitRegister={handleRegisterSubmit}
        onQuickLogin={handleQuickLogin}
      />

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default App
