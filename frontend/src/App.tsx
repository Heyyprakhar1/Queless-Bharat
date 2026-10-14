import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  cancelQueueSession,
  checkInQueue,
  completeService,
  fetchCities,
  fetchLocations,
  fetchOperatorDesk,
  fetchQueueStatus,
  fetchServices,
  fetchUserQueueStatus,
  startService,
} from './api/queue'
import {
  AdminWorkspace,
  AuthModal,
  ChakraWatermark,
  CitizenTokenDesk,
  Footer,
  Header,
  IndiaDemoExplorer,
  IndianFlag,
  OperatorDesk,
  Sidebar,
  SmartVisitPlanner,
  TricolourWatermarkFlow,
} from './components'
import type { SidebarTab } from './components/Sidebar'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider, useLanguage } from './i18n'
import type { User } from './types/auth'
import type {
  Location,
  OperatorDeskResponse,
  QueueStatusResponse,
  Service,
  UserQueueStatusResponse,
} from './types/queue'

function AppContent() {
  const { t } = useLanguage()
  const [routeAccessNotice, setRouteAccessNotice] = useState<string | null>(null)

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
  const [facilitiesLoading, setFacilitiesLoading] = useState<boolean>(false)
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [facilityServices, setFacilityServices] = useState<Service[]>([])
  const [selectedDemoServiceId, setSelectedDemoServiceId] = useState<string>('')
  const [demoQueueStatus, setDemoQueueStatus] = useState<QueueStatusResponse | null>(null)
  const [demoQueueLoading, setDemoQueueLoading] = useState<boolean>(false)
  const [demoQueueError, setDemoQueueError] = useState<string | null>(null)
  const latestQueueServiceIdRef = useRef<string>('')

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
  const [deskData, setDeskData] = useState<OperatorDeskResponse | null>(null)
  const [activeNav, setActiveNav] = useState<SidebarTab>('findServices')

  // Validate session on load
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      getMe()
        .then((user) => {
          setCurrentUser(user)
          if (user.full_name && !citizenName) setCitizenName(user.full_name)
          if (user.email && !citizenEmail) setCitizenEmail(user.email)
          if (user.role === 'ADMIN') {
            setCurrentWorkspace('staff')
          } else {
            setCurrentWorkspace('citizen')
          }
        })
        .catch(() => {
          clearAuthSession()
          setCurrentUser(null)
          setCurrentWorkspace('citizen')
        })
    }
  }, [])

  // Direct URL route checking (e.g. #admin, /admin, #operator, /operator)
  useEffect(() => {
    const handleUrlRoute = () => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash.toLowerCase()
      const path = window.location.pathname.toLowerCase()
      const search = window.location.search.toLowerCase()

      const isAdminTarget =
        hash === '#admin' ||
        path === '/admin' ||
        search.includes('workspace=admin') ||
        search.includes('workspace=staff')
      const isOperatorTarget =
        hash === '#operator' ||
        path === '/operator' ||
        search.includes('workspace=operator')

      if (isAdminTarget) {
        if (currentUser?.role === 'ADMIN') {
          setCurrentWorkspace('staff')
          setRouteAccessNotice(null)
        } else {
          setCurrentWorkspace('citizen')
          setRouteAccessNotice(
            currentUser
              ? 'Administrator credentials required to access the Admin Workspace.'
              : 'Please sign in with an Administrator account to access the Admin Workspace.'
          )
        }
      } else if (isOperatorTarget) {
        setCurrentWorkspace('citizen')
        setRouteAccessNotice('Operator Workspace is not active in this release.')
      }
    }

    handleUrlRoute()
    window.addEventListener('hashchange', handleUrlRoute)
    window.addEventListener('popstate', handleUrlRoute)
    return () => {
      window.removeEventListener('hashchange', handleUrlRoute)
      window.removeEventListener('popstate', handleUrlRoute)
    }
  }, [currentUser])

  // Sync citizen inputs when currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.full_name) setCitizenName(currentUser.full_name)
      if (currentUser.email) setCitizenEmail(currentUser.email)
    }
  }, [currentUser])

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
    loadGlobalCatalog()
    fetchGoogleAuthConfig()
      .then((cfg) => {
        if (cfg.enabled && cfg.client_id) {
          setGoogleClientId(cfg.client_id)
        } else if (!cfg.enabled) {
          setGoogleClientId(null)
        }
      })
      .catch(() => {
        setGoogleClientId(null)
      })
  }, [])

  // Load facilities for city
  const loadFacilitiesForCity = useCallback(async (city: string) => {
    if (!city) return
    setFacilitiesLoading(true)
    setFacilitiesError(null)
    try {
      const locs = await fetchLocations(city)
      setFacilities(locs)
      if (locs.length > 0) {
        setSelectedFacilityId(locs[0].id)
      } else {
        setSelectedFacilityId('')
        setFacilityServices([])
        setSelectedDemoServiceId('')
        setDemoQueueStatus(null)
      }
    } catch (err) {
      setFacilitiesError(err instanceof Error ? err.message : 'Failed to load facilities')
      setFacilities([])
      setSelectedFacilityId('')
      setFacilityServices([])
      setSelectedDemoServiceId('')
      setDemoQueueStatus(null)
    } finally {
      setFacilitiesLoading(false)
    }
  }, [])

  // Cleanly switch city and clear all dependent state to prevent stale data
  const handleSelectCity = (newCity: string) => {
    if (newCity === selectedCity) {
      if (facilities.length === 0) {
        loadFacilitiesForCity(newCity)
      }
      return
    }
    setSelectedCity(newCity)
    setSelectedFacilityId('')
    setFacilities([])
    setFacilityServices([])
    setSelectedDemoServiceId('')
    setDemoQueueStatus(null)
    setDemoQueueError(null)
    setFacilitiesError(null)
  }

  // Cleanly switch facility and clear child services/queue state
  const handleSelectFacility = (newFacilityId: string) => {
    if (newFacilityId === selectedFacilityId) return
    setSelectedFacilityId(newFacilityId)
    setFacilityServices([])
    setSelectedDemoServiceId('')
    setDemoQueueStatus(null)
    setDemoQueueError(null)
  }

  // Cleanly switch demo service and reset queue status
  const handleSelectDemoService = (newServiceId: string) => {
    if (newServiceId === selectedDemoServiceId) return
    setSelectedDemoServiceId(newServiceId)
    setDemoQueueStatus(null)
    setDemoQueueError(null)
  }

  // Load facilities when selected city changes
  useEffect(() => {
    if (selectedCity) {
      loadFacilitiesForCity(selectedCity)
    }
  }, [selectedCity, loadFacilitiesForCity])

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
          setFacilityServices([])
          setSelectedDemoServiceId('')
          setDemoQueueStatus(null)
        }
      }
    }
    loadServicesForFacility()
    return () => {
      isCancelled = true
    }
  }, [selectedFacilityId])

  // Load queue status for explorer with race condition prevention
  const loadDemoQueueStatus = async (serviceId: string) => {
    if (!serviceId) return
    latestQueueServiceIdRef.current = serviceId
    setDemoQueueLoading(true)
    setDemoQueueError(null)
    try {
      const status = await fetchQueueStatus(serviceId)
      if (latestQueueServiceIdRef.current === serviceId) {
        setDemoQueueStatus(status)
      }
    } catch (err) {
      if (latestQueueServiceIdRef.current === serviceId) {
        setDemoQueueError(err instanceof Error ? err.message : 'Failed to fetch queue status')
        setDemoQueueStatus(null)
      }
    } finally {
      if (latestQueueServiceIdRef.current === serviceId) {
        setDemoQueueLoading(false)
      }
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
      if (resp.user.role === 'ADMIN') {
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
    setRouteAccessNotice(null)
    setDeskData(null)
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
      await loadOperatorDesk(targetServiceId)
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
      await loadOperatorDesk()
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

  // --- Operator Actions & Desk State ---

  const loadOperatorDesk = async (targetSvcId?: string) => {
    if (!currentUser || (currentUser.role !== 'OPERATOR' && currentUser.role !== 'ADMIN')) {
      return
    }
    const svcId =
      targetSvcId ||
      currentUser.assigned_service_id ||
      selectedServiceId ||
      selectedDemoServiceId
    if (!svcId) return
    try {
      const data = await fetchOperatorDesk(svcId)
      setDeskData(data)
    } catch {
      // Keep existing state
    }
  }

  // Polling for Operator Desk when in staff workspace
  useEffect(() => {
    if (
      currentWorkspace === 'staff' &&
      (currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN')
    ) {
      loadOperatorDesk()
      const timer = setInterval(() => {
        loadOperatorDesk()
      }, 5000)
      return () => clearInterval(timer)
    }
  }, [currentWorkspace, currentUser, selectedServiceId, selectedDemoServiceId])

  const handleOperatorStart = async (sessionId?: string) => {
    if (currentUser?.role !== 'OPERATOR' && currentUser?.role !== 'ADMIN') {
      return
    }
    const targetSessionId =
      sessionId ||
      deskData?.waiting_sessions?.[0]?.id ||
      (userStatus?.session.status === 'WAITING' ? activeSessionId : '')
    if (!targetSessionId) return
    setCitizenLoading(true)
    setOperatorMessage(null)
    setOperatorIsError(false)
    try {
      await startService(targetSessionId)
      setOperatorMessage('Participant moved into service at counter.')
      setOperatorIsError(false)
      if (activeSessionId) {
        await loadUserStatus(activeSessionId)
      }
      await loadOperatorDesk()
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

  const handleOperatorComplete = async (sessionId?: string) => {
    if (currentUser?.role !== 'OPERATOR' && currentUser?.role !== 'ADMIN') {
      return
    }
    const targetSessionId =
      sessionId ||
      deskData?.active_session?.id ||
      (userStatus?.session.status === 'IN_SERVICE' ? activeSessionId : '')
    if (!targetSessionId) return
    setCitizenLoading(true)
    setOperatorMessage(null)
    setOperatorIsError(false)
    try {
      await completeService(targetSessionId)
      setOperatorMessage('Service marked completed! Observation recorded for wait estimator.')
      setOperatorIsError(false)
      if (activeSessionId) {
        await loadUserStatus(activeSessionId)
      }
      await loadOperatorDesk()
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

  return (
    <div className="min-h-screen civic-tricolour-mesh relative overflow-x-hidden text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-150 py-4 px-3 sm:px-6 lg:px-8 space-y-6">
      {/* Subtle Ambient Indian Tricolour Flow & Chakra Watermark */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none select-none z-0 overflow-hidden">
        <TricolourWatermarkFlow className="w-full h-44 opacity-80" />
      </div>
      <div className="absolute top-4 right-4 lg:right-24 pointer-events-none select-none z-0 overflow-hidden">
        <ChakraWatermark className="w-72 h-72 sm:w-96 sm:h-96 lg:w-[460px] lg:h-[460px] text-blue-950/[0.035] dark:text-blue-300/[0.025]" />
      </div>

      {/* 1. TOP GLOBAL BRAND HERO HEADER */}
      <header className="max-w-[1440px] mx-auto w-full space-y-3 relative z-10">
        {/* Brand Bar: Wordmark, Indian Flag, Tagline */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1">
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-serif font-black text-2xl sm:text-3xl text-slate-950 dark:text-white tracking-tight">
                QueuelessBharat
              </span>
              <IndianFlag className="w-7 h-4.5 rounded-xs shadow-2xs border border-slate-200 dark:border-slate-700" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              {t('brand.tagline')}
            </p>
          </div>
        </div>

        {/* Editorial Subtitle & Simulation Notice */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {t('hero.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 italic">
            {t('hero.subtitle')}
          </p>

          <div
            id="simulation-notice-banner"
            className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center space-x-2 text-left"
          >
            <span className="font-extrabold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] tracking-wider uppercase shrink-0">
              {t('hero.simulatedBadge')}
            </span>
            <span>
              {t('hero.simulatedNotice')}
            </span>
          </div>
        </div>
      </header>

      {/* 2. ROUNDED APPLICATION CONTAINER SHELL */}
      <div className="max-w-[1440px] mx-auto w-full bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col relative z-10">
        <div className="civic-tricolour-hairline" />
        {/* Application Header inside container frame */}
        <Header
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

        {/* Route Access Notice Alert */}
        {routeAccessNotice && (
          <div
            id="route-access-notice"
            role="alert"
            className="m-4 sm:m-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center space-x-2">
              <span className="font-bold shrink-0">Access Restricted:</span>
              <span>{routeAccessNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRouteAccessNotice(null)}
              className="text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 font-bold px-2 py-1 rounded cursor-pointer"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        {currentWorkspace === 'staff' && currentUser?.role === 'ADMIN' ? (
          <main className="p-4 sm:p-6 lg:p-8 space-y-6">
            <AdminWorkspace
              currentUser={currentUser}
              cities={cities}
              facilities={facilities}
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              onRefreshData={() => {
                loadGlobalCatalog()
              }}
            />
          </main>
        ) : (
          /* 3-Column Citizen Experience on desktop */
          <main className="flex-1 flex flex-col lg:flex-row">
            {/* Column 1: Left Navigation Sidebar */}
            <Sidebar
              activeTab={activeNav}
              onSelectTab={setActiveNav}
              activeTokenCount={activeSessionId && userStatus ? 1 : 0}
            />

            {/* Column 2: Center Main Citizen Workspace */}
            <div className="flex-1 min-w-0 border-t lg:border-t-0 lg:border-r border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 lg:p-7 space-y-6">
              {activeNav === 'myTokens' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {t('tokenDesk.title')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('tokenDesk.civicSelfService')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('findServices')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      &larr; Back to Services
                    </button>
                  </div>
                  <CitizenTokenDesk
                    compact={false}
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
                    {activeSessionId && userStatus && (currentUser?.role === 'ADMIN' || currentUser?.role === 'OPERATOR') && (
                      <OperatorDesk
                        currentUser={currentUser}
                        deskData={deskData}
                        userStatus={userStatus}
                        citizenLoading={citizenLoading}
                        operatorMessage={operatorMessage}
                        operatorIsError={operatorIsError}
                        onStartService={handleOperatorStart}
                        onCompleteService={handleOperatorComplete}
                        onRefreshStatus={() => {
                          loadUserStatus(activeSessionId)
                          loadOperatorDesk()
                        }}
                      />
                    )}
                  </CitizenTokenDesk>
                </div>
              ) : (
                <>
                  <IndiaDemoExplorer
                    cities={cities}
                    selectedCity={selectedCity}
                    onSelectCity={handleSelectCity}
                    facilities={facilities}
                    selectedFacilityId={selectedFacilityId}
                    onSelectFacility={handleSelectFacility}
                    facilityServices={facilityServices}
                    selectedDemoServiceId={selectedDemoServiceId}
                    onSelectDemoService={handleSelectDemoService}
                    demoQueueStatus={demoQueueStatus}
                    demoQueueLoading={demoQueueLoading}
                    demoQueueError={demoQueueError}
                    facilitiesLoading={facilitiesLoading}
                    facilitiesError={facilitiesError}
                    onRetryFacilities={() => {
                      if (selectedCity) loadFacilitiesForCity(selectedCity)
                    }}
                    onTestServiceInTokenDesk={(serviceId) => {
                      setSelectedServiceId(serviceId)
                      setActiveNav('myTokens')
                      const deskEl = document.getElementById('citizen-token-desk-section')
                      if (deskEl) {
                        deskEl.scrollIntoView({ behavior: 'smooth' })
                      }
                    }}
                    onCheckQueue={() => {
                      if (selectedDemoServiceId) {
                        loadDemoQueueStatus(selectedDemoServiceId)
                        const waitEl = document.getElementById('demo-wait-projection')
                        if (waitEl) {
                          waitEl.scrollIntoView({ behavior: 'smooth' })
                        }
                      }
                    }}
                  />

                  {/* M6.3 Smart Visit Planner (Arrival Window & Document Readiness Checklist) */}
                  <SmartVisitPlanner
                    serviceId={selectedDemoServiceId || selectedServiceId || null}
                    serviceName={
                      facilityServices.find((s) => s.id === (selectedDemoServiceId || selectedServiceId))?.name ||
                      services.find((s) => s.id === (selectedDemoServiceId || selectedServiceId))?.name ||
                      null
                    }
                    facilityName={
                      facilities.find((f) => f.id === selectedFacilityId)?.name || null
                    }
                    cityName={selectedCity || null}
                  />
                </>
              )}
            </div>

            {/* Column 3: Right Persistent Token Panel ("My Queue Token") */}
            <div
              id="citizen-token-desk-section"
              className="w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 lg:p-6 bg-slate-50/40 dark:bg-slate-900/40"
            >
              <CitizenTokenDesk
                compact={true}
                onViewFullDesk={() => setActiveNav('myTokens')}
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
                {activeSessionId && userStatus && (currentUser?.role === 'ADMIN' || currentUser?.role === 'OPERATOR') && (
                  <OperatorDesk
                    currentUser={currentUser}
                    deskData={deskData}
                    userStatus={userStatus}
                    citizenLoading={citizenLoading}
                    operatorMessage={operatorMessage}
                    operatorIsError={operatorIsError}
                    onStartService={handleOperatorStart}
                    onCompleteService={handleOperatorComplete}
                    onRefreshStatus={() => {
                      loadUserStatus(activeSessionId)
                      loadOperatorDesk()
                    }}
                  />
                )}
              </CitizenTokenDesk>
            </div>
          </main>
        )}
      </div>

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
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
