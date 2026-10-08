import type React from 'react'
import type { User } from '../types/auth'
import type { Service, UserQueueStatusResponse } from '../types/queue'

interface CitizenTokenDeskProps {
  currentUser: User | null
  services: Service[]
  selectedServiceId: string
  onSelectService: (serviceId: string) => void
  citizenName: string
  onChangeCitizenName: (name: string) => void
  citizenEmail: string
  onChangeCitizenEmail: (email: string) => void
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
  services,
  selectedServiceId,
  onSelectService,
  citizenName,
  onChangeCitizenName,
  citizenEmail,
  onChangeCitizenEmail,
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

  // Format token cleanly: prefer queue position or short ticket code
  const tokenDisplay = userStatus?.position
    ? `#Q-${String(userStatus.position).padStart(3, '0')}`
    : activeSessionId
      ? `TK-${activeSessionId.slice(0, 6).toUpperCase()}`
      : ''

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900">
              Citizen Digital Token Desk
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Self-Service Queue Desk
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Join an active public queue, obtain a digital token, and track your deterministic wait time in real-time.
          </p>
        </div>

        {activeSessionId && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
              Token {tokenDisplay}
            </span>
          </div>
        )}
      </div>

      {/* Recoverable Notice Banner (e.g. after stale 404 session recovery) */}
      {sessionNotice && (
        <div
          id="stale-session-notice"
          className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs sm:text-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-sky-200 text-sky-900 px-1.5 py-0.5 rounded">
              NOTICE
            </span>
            <span>{sessionNotice}</span>
          </div>
          <button
            type="button"
            onClick={onClearSessionNotice}
            className="text-sky-600 hover:text-sky-800 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Citizen Error Message */}
      {citizenError && (
        <div
          id="citizen-error-msg"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm"
        >
          <strong>Notice:</strong> {citizenError}
        </div>
      )}

      {/* FORM: Issue New Digital Token */}
      {!activeSessionId ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="facility-service"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Select Public Service
              </label>
              <select
                id="facility-service"
                value={selectedServiceId}
                onChange={(e) => onSelectService(e.target.value)}
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
              <label
                htmlFor="citizen-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Citizen Full Name
              </label>
              <input
                id="citizen-name"
                type="text"
                value={citizenName}
                onChange={(e) => onChangeCitizenName(e.target.value)}
                placeholder="e.g. Citizen Amit Sharma"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="citizen-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="citizen-email"
                type="email"
                value={citizenEmail}
                onChange={(e) => onChangeCitizenEmail(e.target.value)}
                placeholder="citizen@queless.gov.in"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <button
              id="btn-join-queue"
              type="button"
              onClick={onJoinQueue}
              disabled={citizenLoading || (services.length === 0 && !selectedDemoServiceId)}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {citizenLoading ? 'Issuing Digital Token...' : 'Issue Digital Token'}
            </button>

            {!currentUser && (
              <span className="text-xs text-slate-500">
                Low-friction citizen access. An unprivileged citizen token session will be issued automatically.
              </span>
            )}
          </div>
        </div>
      ) : userStatus ? (
        /* LIVE ACTIVE TICKET DISPLAY */
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    {userStatus.service.name}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">
                    {tokenDisplay}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {citizenName || userStatus.session.user_id || 'Citizen Participant'}
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Ref: {userStatus.session.id}
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
                <span
                  className={`w-2 h-2 rounded-full ${
                    isTerminalTicket ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span>
                  {isTerminalTicket
                    ? 'Queue session ended. Polling stopped.'
                    : 'Auto-updating via HTTP short polling (5s interval)'}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onRefreshTicket}
                  disabled={citizenLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
                >
                  Refresh
                </button>

                {!isTerminalTicket ? (
                  <button
                    type="button"
                    onClick={onCancelTicket}
                    disabled={citizenLoading}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-medium transition cursor-pointer"
                  >
                    Leave Queue / Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDismissTicket}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition cursor-pointer"
                  >
                    Take New Token
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Operator Desk / Actions (passed as children) */}
          {children}
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-slate-500">
          Loading digital token details...
        </div>
      )}
    </div>
  )
}
