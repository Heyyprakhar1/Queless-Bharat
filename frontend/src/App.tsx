import { useEffect, useState } from 'react'
import type React from 'react'
import {
  clearAuthSession,
  fetchGoogleAuthConfig,
  getAuthToken,
  getMe,
  getStoredUser,
  googleLogin,
  login,
  logout,
  register,
} from './api/auth'
import { ApiError } from './api/client'
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
  AdminWorkspace,
  AuthModal,
  CitizenTokenDesk,
  Footer,
  Header,
  HealthPanel,
  IndiaDemoExplorer,
  OperatorDesk,
} from './components'
import type { User } from './types/auth'
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

  // Auth & Identity State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser())
  const [currentWorkspace, setCurrentWorkspace] = useState<'citizen' | 'staff'>('citizen')
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false)
  const [authTab, setAuthTab] = useState<'citizen' | 'staff' | 'register'>('citizen')
  const [authEmail, setAuthEmail] = useState<string>('')
  const [authPassword, setAuthPassword] = useState<string>('')
  const [authFullName, setAuthFullName] = useState<string>('')
  const [authLoading, setAuthLoading] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    () => import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  )

  // Citizen Input State (defaults to current user if logged in)
  const [citizenName, setCitizenName] = useState<string>(() => getStoredUser()?.full_name || '')
  const [citizenEmail, setCitizenEmail] = useState<string>(() => getStoredUser()?.email || '')

  // M6.1.2 India Demo Explorer State (20 Urban Markets)
  const [cities, setCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('Pune')
  const [facilities, setFacilities] = useState<Location[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [facilityServices, setFacilityServices] = useState<Service[]>([])
  const [selectedDemoServiceId, setSelectedDemoServiceId] = useState<string>('')
  const [demoQueueStatus, setDemoQueueStatus] = useState<QueueStatusResponse | null>(null)
  const [demoQueueLoading, setDemoQueueLoading] = useState<boolean>(false)
  const [demoQueueError, setDemoQueueError] = useState<string | null>(null)

  // Citizen Interactive Flow State
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem('queless_active_session_id') || ''
  })
  const [userStatus, setUserStatus] = useState<UserQueueStatusResponse | null>(null)
  const [citizenLoading, setCitizenLoading] = useState<boolean>(false)
  const [citizenError, setCitizenError] = useState<string | null>(null)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const [operatorMessage, setOperatorMessage] = useState<string | null>(null)
  const [operatorIsError, setOperatorIsError] = useState<boolean>(false)

  // Validate session on load
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      getMe()
        .then((user) => {
          setCurrentUser(user)
          if (user.full_name && !citizenName) setCitizenName(user.full_name)
          if (user.email && !citizenEmail) setCitizenEmail(user.email)
          if (user.role === 'OPERATOR' || user.role === 'ADMIN') {
            setCurrentWorkspace('staff')
          }
        })
        .catch(() => {
          clearAuthSession()
          setCurrentUser(null)
          setCurrentWorkspace('citizen')
        })
    }
  }, [])

  // Sync citizen inputs when currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.full_name) setCitizenName(currentUser.full_name)
      if (currentUser.email) setCitizenEmail(currentUser.email)
    }
  }, [currentUser])

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
        // Fallback default cities will be handled by components
      }
    }
    initCities()
    checkHealth()
    loadGlobalCatalog()
    fetchGoogleAuthConfig().then((cfg) => {
      if (cfg.client_id) setGoogleClientId(cfg.client_id)
    })
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

  // Load queue status for explorer
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

  // Single-shot load ticket status with 404 recovery
  const loadUserStatus = async (sessionId: string) => {
    if (!sessionId) return
    try {
      const status = await fetchUserQueueStatus(sessionId)
      setUserStatus(status)
      setCitizenError(null)
      setSessionNotice(null)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        localStorage.removeItem('queless_active_session_id')
        setActiveSessionId('')
        setUserStatus(null)
        setSessionNotice(
          'Your previous queue session is no longer active. You can issue a new digital token.'
        )
        setCitizenError(null)
      } else {
        setCitizenError(err instanceof Error ? err.message : 'Failed to fetch ticket status')
      }
    }
  }

  // Active Ticket Status Polling with 404 recovery & terminal status detection
  useEffect(() => {
    if (!activeSessionId) return
    let isCancelled = false
    let timerId: ReturnType<typeof setInterval> | null = null

    const pollTicket = async () => {
      try {
        const status = await fetchUserQueueStatus(activeSessionId)
        if (!isCancelled) {
          setUserStatus(status)
          setCitizenError(null)
          // Stop polling if ticket reached terminal status
          if (status.session.status === 'COMPLETED' || status.session.status === 'CANCELLED') {
            if (timerId) {
              clearInterval(timerId)
              timerId = null
            }
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          if (err instanceof ApiError && err.status === 404) {
            // Immediate stale session recovery: stop polling, clear storage, reset state
            localStorage.removeItem('queless_active_session_id')
            setActiveSessionId('')
            setUserStatus(null)
            setSessionNotice(
              'Your previous queue session is no longer active. You can issue a new digital token.'
            )
            setCitizenError(null)
            if (timerId) {
              clearInterval(timerId)
              timerId = null
            }
          } else {
            setCitizenError(err instanceof Error ? err.message : 'Failed to fetch ticket status')
          }
        }
      }
    }

    pollTicket()
    timerId = setInterval(pollTicket, 5000)

    return () => {
      isCancelled = true
      if (timerId) clearInterval(timerId)
    }
  }, [activeSessionId])

  // --- Auth Handlers ---

  // Staff Portal Login (Work email + password)
  const handleStaffLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const resp = await login({ email: authEmail, password: authPassword })
      setCurrentUser(resp.user)
      setShowAuthModal(false)
      setAuthPassword('')
      if (resp.user.role === 'OPERATOR' || resp.user.role === 'ADMIN') {
        setCurrentWorkspace('staff')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setAuthLoading(false)
    }
  }

  // Google Citizen Sign-In
  const handleGoogleSignIn = async (idToken: string) => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const resp = await googleLogin(idToken)
      setCurrentUser(resp.user)
      setShowAuthModal(false)
      setCitizenName(resp.user.full_name)
      setCitizenEmail(resp.user.email)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setAuthLoading(false)
    }
  }

  // Traditional Registration
  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const resp = await register({
        email: authEmail,
        password: authPassword,
        full_name: authFullName,
        role: 'CITIZEN',
      })
      setCurrentUser(resp.user)
      setShowAuthModal(false)
      setAuthPassword('')
      setCitizenName(resp.user.full_name || authFullName)
      setCitizenEmail(resp.user.email)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setCurrentUser(null)
    setCurrentWorkspace('citizen')
    setCitizenError(null)
    setOperatorMessage(null)
  }

  // --- Queue Ticket Actions ---

  const handleJoinQueue = async () => {
    const targetServiceId = selectedServiceId || selectedDemoServiceId
    if (!targetServiceId) return
    setCitizenLoading(true)
    setCitizenError(null)
    setOperatorMessage(null)
    setSessionNotice(null)

    try {
      // Require authenticated citizen session (Google OpenID Connect)
      if (!currentUser || !getAuthToken()) {
        setShowAuthModal(true)
        setAuthTab('citizen')
        setCitizenError('Please sign in with Google to issue your personal digital queue token.')
        return
      }

      const idempotencyKey = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const participantName = currentUser.full_name || citizenName.trim() || undefined
      const session = await checkInQueue(
        targetServiceId,
        participantName,
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

  const handleDismissTicket = () => {
    setActiveSessionId('')
    setUserStatus(null)
    localStorage.removeItem('queless_active_session_id')
    setOperatorMessage(null)
    setSessionNotice(null)
  }

  // --- Operator Actions ---

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
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
        onLogout={handleLogout}
        onOpenCitizenAccess={() => {
          setAuthTab('citizen')
          setAuthError(null)
          setShowAuthModal(true)
        }}
        onOpenStaffPortal={() => {
          setAuthTab('staff')
          setAuthError(null)
          setShowAuthModal(true)
        }}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* If Staff Workspace is active and User is Admin */}
        {currentWorkspace === 'staff' && currentUser?.role === 'ADMIN' ? (
          <AdminWorkspace
            currentUser={currentUser}
            cities={cities}
            facilities={facilities}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            onRefreshData={() => {
              checkHealth()
              loadGlobalCatalog()
            }}
          />
        ) : currentWorkspace === 'staff' && currentUser?.role === 'OPERATOR' ? (
          /* Standalone Operator Workspace Shell */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black text-slate-900">
                    Desk Operator Workspace
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300">
                    OPERATOR ACTIVE
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Counter intake, citizen queue advancement, and empirical throughput recording.
                </p>
              </div>

              <div className="text-xs text-slate-600">
                Staff Account: <strong>{currentUser.full_name || currentUser.email}</strong>
              </div>
            </div>

            {userStatus ? (
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
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 space-y-2">
                <p>No active participant currently seated at this desk.</p>
                <p className="text-xs text-slate-400">
                  Switch to the Citizen Portal tab to issue a test token or observe queue intake.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* CITIZEN PORTAL (Default view for Public Citizens and Demo Observers) */
          <>
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

            {/* SECTION 1: M6.1.2 INDIA CIVIC QUEUE EXPLORER (20 CITIES & 12 CATEGORIES) */}
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
                window.scrollTo({ top: 850, behavior: 'smooth' })
              }}
            />

            {/* SECTION 2: CITIZEN DIGITAL TOKEN DESK (LIFECYCLE, 404 RECOVERY & OPERATOR ACTIONS) */}
            <CitizenTokenDesk
              currentUser={currentUser}
              onOpenSignIn={() => {
                setAuthTab('citizen')
                setShowAuthModal(true)
                setAuthError(null)
              }}
              services={services}
              selectedServiceId={selectedServiceId}
              onSelectService={setSelectedServiceId}
              citizenName={citizenName}
              onChangeCitizenName={setCitizenName}
              citizenEmail={citizenEmail}
              onChangeCitizenEmail={setCitizenEmail}
              activeSessionId={activeSessionId}
              userStatus={userStatus}
              citizenLoading={citizenLoading}
              citizenError={citizenError}
              sessionNotice={sessionNotice}
              onClearSessionNotice={() => setSessionNotice(null)}
              selectedDemoServiceId={selectedDemoServiceId}
              onJoinQueue={handleJoinQueue}
              onCancelTicket={handleCancelTicket}
              onDismissTicket={handleDismissTicket}
              onRefreshTicket={() => loadUserStatus(activeSessionId)}
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
          </>
        )}
      </main>

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={showAuthModal}
        activeTab={authTab}
        onClose={() => setShowAuthModal(false)}
        onTabChange={(tab) => {
          setAuthTab(tab)
          setAuthError(null)
        }}
        googleClientId={googleClientId}
        onGoogleSignIn={handleGoogleSignIn}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        onSubmitStaffLogin={handleStaffLoginSubmit}
        authFullName={authFullName}
        setAuthFullName={setAuthFullName}
        onSubmitRegister={handleRegisterSubmit}
        authLoading={authLoading}
        authError={authError}
        onClearAuthError={() => setAuthError(null)}
      />

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default App
