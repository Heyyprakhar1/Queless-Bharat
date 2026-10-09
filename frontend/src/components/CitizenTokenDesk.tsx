import type React from 'react'
import type { User } from '../types/auth'
import type { Service, UserQueueStatusResponse } from '../types/queue'
import { Alert, Badge, Button, Card } from './ui'

interface CitizenTokenDeskProps {
  currentUser: User | null
  onOpenSignIn?: () => void
  services: Service[]
  selectedServiceId: string
  onSelectService: (serviceId: string) => void
  citizenName?: string
  onChangeCitizenName?: (name: string) => void
  citizenEmail?: string
  onChangeCitizenEmail?: (email: string) => void
  activeSessionId: string
  userStatus: UserQueueStatusResponse | null
  citizenLoading: boolean
  citizenError: string | null
  sessionNotice: string | null
  onClearSessionNotice: () => void
  selectedDemoServiceId: string
  onJoinQueue: () => void
  onCancelTicket: () => void
  onDismissTicket: () => void
  onRefreshTicket: () => void
  children?: React.ReactNode
}

export const CitizenTokenDesk: React.FC<CitizenTokenDeskProps> = ({
  currentUser,
  onOpenSignIn,
  services,
  selectedServiceId,
  onSelectService,
  citizenName,
  onChangeCitizenName,
  citizenEmail: _citizenEmail,
  onChangeCitizenEmail: _onChangeCitizenEmail,
  activeSessionId,
  userStatus,
  citizenLoading,
  citizenError,
  sessionNotice,
  onClearSessionNotice,
  selectedDemoServiceId,
  onJoinQueue,
  onCancelTicket,
  onDismissTicket,
  onRefreshTicket,
  children,
}) => {
  const isTerminalTicket =
    userStatus?.session.status === 'COMPLETED' || userStatus?.session.status === 'CANCELLED'

  // Format token cleanly: human-readable queue position or compact ticket code
  const tokenDisplay = userStatus?.position
    ? `#Q-${String(userStatus.position).padStart(3, '0')}`
    : activeSessionId
      ? `TK-${activeSessionId.slice(0, 6).toUpperCase()}`
      : ''

  return (
    <Card variant="elevated" className="space-y-6">
      {/* Desk Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Citizen Digital Token Desk
            </h2>
            <Badge variant="success" size="sm">
              Civic Self-Service
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Join public queue lines, receive verified digital tokens, and track deterministic waiting times.
          </p>
        </div>

        {activeSessionId && userStatus && (
          <div className="flex items-center space-x-2">
            <Badge variant="primary" size="md" className="font-mono font-bold text-xs">
              Token {tokenDisplay}
            </Badge>
          </div>
        )}
      </div>

      {/* Recoverable Notice Banner (e.g. after stale 404 session recovery) */}
      {sessionNotice && (
        <Alert
          id="stale-session-notice"
          variant="info"
          title="Session Notice"
          onClose={onClearSessionNotice}
        >
          {sessionNotice}
        </Alert>
      )}

      {/* Error Message */}
      {citizenError && (
        <Alert id="citizen-error-msg" variant="error" title="Notice">
          {citizenError}
        </Alert>
      )}

      {/* STATE 1: SIGNED OUT — GOOGLE AUTH REQUIRED */}
      {!currentUser ? (
        <div id="token-desk-signed-out" className="py-8 px-4 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 mx-auto flex items-center justify-center text-indigo-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              Verified Citizen Access Required
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              To issue a digital queue token and reserve your service window, please sign in using your verified Google identity. This guarantees genuine personal queuing and stops slot hoarding.
            </p>
          </div>

          <div className="pt-2">
            <Button
              id="btn-desk-signin"
              type="button"
              variant="primary"
              size="md"
              onClick={onOpenSignIn}
              className="w-full sm:w-auto px-6 py-2.5 shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#ffffff"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                />
              </svg>
              Continue with Google to Issue Token
            </Button>
          </div>
        </div>
      ) : !activeSessionId ? (
        /* STATE 2: SIGNED IN WITH NO ACTIVE TOKEN — SERVICE SELECTION FORM */
        <div id="token-desk-issue-token" className="space-y-5">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Verified Citizen:</span>
              <span id="desk-verified-identity" className="font-bold text-slate-900">
                {currentUser.full_name} ({currentUser.email})
              </span>
            </div>
            <Badge variant="primary" size="sm">
              CITIZEN
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="facility-service"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Select Civic Service Window
              </label>
              <select
                id="facility-service"
                value={selectedServiceId}
                onChange={(e) => onSelectService(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={services.length === 0}
              >
                {services.length === 0 ? (
                  <option value="">No services available for selected facility</option>
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
              <label
                htmlFor="citizen-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Citizen Participant Name
              </label>
              <input
                id="citizen-name"
                type="text"
                value={citizenName || ''}
                onChange={(e) => onChangeCitizenName?.(e.target.value)}
                placeholder={currentUser.full_name || 'Citizen Full Name'}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Button
                id="btn-join-queue"
                type="button"
                variant="primary"
                size="md"
                onClick={onJoinQueue}
                disabled={citizenLoading || (services.length === 0 && !selectedDemoServiceId)}
                isLoading={citizenLoading}
                loadingText="Issuing Digital Token..."
              >
                Issue Digital Token
              </Button>

              <span className="text-xs text-slate-500">
                Token will be assigned under your verified Google identity.
              </span>
            </div>
          </div>
        </div>
      ) : userStatus ? (
        /* STATE 3: LIVE ACTIVE TOKEN DISPLAY */
        <div id="token-desk-active-ticket" className="space-y-6">
          <div className="p-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/50 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100/80">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    {userStatus.service.name}
                  </span>
                  <Badge variant="primary" size="sm" className="font-mono font-bold">
                    {tokenDisplay}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {currentUser.full_name || userStatus.session.user_id || 'Citizen Participant'}
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Ref: {userStatus.session.id}
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {userStatus.session.status === 'WAITING' && (
                  <Badge variant="warning" size="md">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-1" />
                    WAITING IN LINE
                  </Badge>
                )}
                {userStatus.session.status === 'IN_SERVICE' && (
                  <Badge variant="success" size="md">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1" />
                    NOW AT COUNTER (IN SERVICE)
                  </Badge>
                )}
                {userStatus.session.status === 'COMPLETED' && (
                  <Badge variant="neutral" size="md">
                    COMPLETED
                  </Badge>
                )}
                {userStatus.session.status === 'CANCELLED' && (
                  <Badge variant="danger" size="md">
                    CANCELLED
                  </Badge>
                )}
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                  Your Queue Position
                </span>
                <div className="text-3xl font-black text-indigo-600 mt-1">
                  {userStatus.position !== null ? `#${userStatus.position}` : '—'}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {userStatus.session.status === 'WAITING'
                    ? 'in queue line'
                    : userStatus.session.status === 'IN_SERVICE'
                      ? 'currently being served'
                      : 'lifecycle completed'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                  People Ahead
                </span>
                <div className="text-3xl font-black text-slate-900 mt-1">
                  {userStatus.people_ahead}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {userStatus.people_ahead === 0 && userStatus.session.status === 'WAITING'
                    ? "You're next in line!"
                    : 'citizens ahead of you'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                  Estimated Wait
                </span>
                <div className="mt-1">
                  {userStatus.estimated_wait.is_available ? (
                    <>
                      <div className="text-2xl font-black text-slate-900">
                        {userStatus.estimated_wait.lower_minutes}&ndash;
                        {userStatus.estimated_wait.upper_minutes}{' '}
                        <span className="text-sm font-normal text-slate-500">mins</span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Expected: ~{userStatus.estimated_wait.expected_minutes} mins
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-amber-700">Estimating...</div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        {userStatus.estimated_wait.reason || 'Data baseline accumulating'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Civic Projection Disclaimer */}
            <div className="text-[11px] text-slate-500 bg-white/70 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
              <span className="font-semibold text-slate-700">Civic Advisory:</span> Waiting time estimates are deterministic projections based on recent window throughput, not guaranteed departure times.
            </div>

            {/* Short Polling Status & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-indigo-100 text-xs">
              <div className="text-slate-500 flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isTerminalTicket ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span>
                  {isTerminalTicket
                    ? 'Queue session ended. Polling stopped.'
                    : 'Auto-updating via HTTP short polling (5s)'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRefreshTicket}
                  disabled={citizenLoading}
                >
                  Refresh
                </Button>

                {!isTerminalTicket ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={onCancelTicket}
                    disabled={citizenLoading}
                  >
                    Leave Queue / Cancel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onDismissTicket}
                  >
                    Take New Token
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Operator Desk / Actions (passed as children) */}
          {children}
        </div>
      ) : (
        /* STATE 4: LOADING / RECOVERING STATE (No infinite spinner) */
        <div id="token-desk-loading" className="py-8 text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-xs sm:text-sm text-slate-500">
            Checking personal digital token details...
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDismissTicket}
              className="text-xs text-slate-600"
            >
              Reset Session
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
