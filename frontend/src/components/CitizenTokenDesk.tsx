import type React from 'react'
import { useLanguage } from '../i18n'
import type { User } from '../types/auth'
import type { Service, UserQueueStatusResponse } from '../types/queue'
import { Alert, Badge, Button, Card, ChakraWatermark } from './ui'

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
  onRefreshTicket?: () => void
  compact?: boolean
  onViewFullDesk?: () => void
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
  compact = true,
  onViewFullDesk,
  children,
}) => {
  const { t } = useLanguage()
  const isTerminalTicket =
    userStatus?.session.status === 'COMPLETED' || userStatus?.session.status === 'CANCELLED'

  // Format token cleanly: human-readable queue position or compact ticket code
  const tokenDisplay = userStatus?.position
    ? `#Q-${String(userStatus.position).padStart(3, '0')}`
    : activeSessionId
      ? `TK-${activeSessionId.slice(0, 6).toUpperCase()}`
      : ''

  const status = userStatus?.session.status

  return (
    <Card variant="elevated" className="space-y-5 h-full flex flex-col justify-between">
      <div className="space-y-4">
        {/* Panel Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {t('tokenPanel.title')}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t('tokenDesk.civicSelfService')}
            </p>
          </div>

          {activeSessionId && userStatus ? (
            <Badge variant="primary" size="md" className="font-mono font-bold text-xs shrink-0">
              {t('tokenDesk.tokenBadge', { display: tokenDisplay })}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" className="shrink-0">
              Live
            </Badge>
          )}
        </div>

        {/* Recoverable Notice Banner */}
        {sessionNotice && (
          <Alert
            id="stale-session-notice"
            variant="info"
            title={t('tokenDesk.sessionNotice')}
            onClose={onClearSessionNotice}
          >
            {sessionNotice}
          </Alert>
        )}

        {/* Error Message */}
        {citizenError && (
          <Alert id="citizen-error-msg" variant="error" title={t('common.notice')}>
            {citizenError}
          </Alert>
        )}

        {/* STATE 1: SIGNED OUT — GOOGLE AUTH REQUIRED */}
        {!currentUser ? (
          <div id="token-desk-signed-out" className="py-6 px-3 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 mx-auto flex items-center justify-center text-blue-700 dark:text-blue-300 shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('tokenDesk.authRequiredHeading')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('tokenDesk.authRequiredDesc')}
              </p>
            </div>

            <div className="pt-2">
              <Button
                id="btn-desk-signin"
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenSignIn}
                className="w-full shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24">
                  <path
                    fill="#ffffff"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                  />
                </svg>
                {t('tokenDesk.continueWithGoogle')}
              </Button>
            </div>
          </div>
        ) : !activeSessionId ? (
          /* STATE 2: SIGNED IN WITH NO ACTIVE TOKEN — CLEAN EMPTY STATE & GET TOKEN FORM */
          <div id="token-desk-issue-token" className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {t('tokenDesk.verifiedCitizenLabel')}
                </span>
                <span id="desk-verified-identity" className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {currentUser.full_name || currentUser.email}
                </span>
              </div>
              <Badge variant="primary" size="sm" className="shrink-0">
                {t('tokenDesk.citizenRole')}
              </Badge>
            </div>

            {/* Empty State Banner */}
            <div className="text-center p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-850/40 space-y-1">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('tokenPanel.noActiveToken')}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('tokenPanel.noActiveTokenDesc')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="facility-service"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('tokenDesk.selectServiceLabel')}
                </label>
                <select
                  id="facility-service"
                  value={selectedServiceId}
                  onChange={(e) => onSelectService(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                  disabled={services.length === 0}
                >
                  {services.length === 0 ? (
                    <option value="">{t('tokenDesk.noServicesFacility')}</option>
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
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('tokenDesk.participantNameLabel')}
                </label>
                <input
                  id="citizen-name"
                  type="text"
                  value={citizenName || ''}
                  onChange={(e) => onChangeCitizenName?.(e.target.value)}
                  placeholder={currentUser.full_name || t('tokenDesk.participantNamePlaceholder')}
                  className="w-full text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                />
              </div>

              <div className="pt-1">
                <Button
                  id="btn-join-queue"
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onJoinQueue}
                  disabled={citizenLoading || (services.length === 0 && !selectedDemoServiceId)}
                  isLoading={citizenLoading}
                  loadingText={t('tokenDesk.issuingDigitalToken')}
                  className="w-full shadow-2xs"
                >
                  {t('tokenDesk.issueDigitalTokenBtn')}
                </Button>
              </div>
            </div>
          </div>
        ) : userStatus ? (
          /* STATE 3: LIVE ACTIVE TOKEN DISPLAY */
          <div id="token-desk-active-ticket" className="space-y-4">
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/40 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/60 space-y-3 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 pointer-events-none select-none z-0">
                <ChakraWatermark className="w-40 h-40 text-blue-950/[0.035] dark:text-blue-300/[0.025]" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-blue-100/80 dark:border-blue-900/40">
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 truncate">
                      {userStatus.service.name}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {currentUser.full_name || userStatus.session.user_id || 'Citizen Participant'}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    {t('tokenDesk.ref', { id: userStatus.session.id })}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {status === 'WAITING' && (
                    <Badge variant="warning" size="md">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
                      {t('tokenDesk.statusWaiting')}
                    </Badge>
                  )}
                  {status === 'IN_SERVICE' && (
                    <Badge variant="success" size="md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1" />
                      {t('tokenDesk.statusInService')}
                    </Badge>
                  )}
                  {status === 'COMPLETED' && (
                    <Badge variant="neutral" size="md">
                      {t('tokenDesk.statusCompleted')}
                    </Badge>
                  )}
                  {status === 'CANCELLED' && (
                    <Badge variant="danger" size="md">
                      {t('tokenDesk.statusCancelled')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Live Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                {/* Position */}
                <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                    {t('tokenDesk.yourQueuePosition')}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-400 my-0.5">
                    {userStatus.position !== null ? `#${userStatus.position}` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                    {status === 'WAITING'
                      ? t('tokenDesk.inQueueLine')
                      : status === 'IN_SERVICE'
                        ? t('tokenDesk.currentlyServed')
                        : t('tokenDesk.lifecycleCompleted')}
                  </span>
                </div>

                {/* People Ahead */}
                <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                    {t('tokenDesk.peopleAhead')}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 my-0.5">
                    {userStatus.people_ahead}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                    {userStatus.people_ahead === 0 && status === 'WAITING'
                      ? t('tokenDesk.nextInLine')
                      : t('tokenDesk.aheadOfYou')}
                  </span>
                </div>

                {/* Estimated Wait */}
                <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                    Wait
                  </span>
                  <div className="my-0.5">
                    {userStatus.estimated_wait.is_available ? (
                      <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                        {userStatus.estimated_wait.lower_minutes}&ndash;
                        {userStatus.estimated_wait.upper_minutes}
                        <span className="text-[10px] font-normal text-slate-500">m</span>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Calc...
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                    {userStatus.estimated_wait.is_available
                      ? `~${userStatus.estimated_wait.expected_minutes ?? 0}m`
                      : 'Estimating'}
                  </span>
                </div>
              </div>

              {/* Visual Lifecycle Progress Timeline (Detailed view) */}
              {!compact && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Lifecycle Progress
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    {/* Step 1: Issued */}
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {t('tokenPanel.timelineIssued')}
                      </span>
                    </div>
                    {/* Step 2: Waiting */}
                    <div className="space-y-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          status === 'WAITING'
                            ? 'bg-amber-500 animate-pulse'
                            : status === 'IN_SERVICE' || status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          status === 'WAITING'
                            ? 'text-amber-700 dark:text-amber-400'
                            : status === 'IN_SERVICE' || status === 'COMPLETED'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {t('tokenPanel.timelineWaiting')}
                      </span>
                    </div>
                    {/* Step 3: Serving */}
                    <div className="space-y-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          status === 'IN_SERVICE'
                            ? 'bg-blue-600 animate-ping'
                            : status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          status === 'IN_SERVICE'
                            ? 'text-blue-700 dark:text-blue-400'
                            : status === 'COMPLETED'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {t('tokenPanel.timelineServing')}
                      </span>
                    </div>
                    {/* Step 4: Done */}
                    <div className="space-y-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          status === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : status === 'CANCELLED'
                              ? 'bg-rose-500'
                              : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          status === 'COMPLETED'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : status === 'CANCELLED'
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {status === 'CANCELLED' ? 'Cancelled' : t('tokenPanel.timelineCompleted')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* View Full Token Desk action in compact mode */}
              {compact && onViewFullDesk && (
                <div className="pt-1">
                  <button
                    id="btn-view-full-token-desk"
                    type="button"
                    onClick={onViewFullDesk}
                    className="w-full py-1.5 px-3 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <span>View Full Token Desk</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              )}

              {/* Short Polling Status & Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-blue-100 dark:border-slate-800 text-xs">
                <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[11px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isTerminalTicket ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                      }`}
                    />
                    <span>
                      {isTerminalTicket
                        ? t('tokenDesk.sessionEndedPolling')
                        : t('tokenDesk.autoPollingActive')}
                    </span>
                  </div>

                  <Button
                    id="btn-refresh-ticket"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRefreshTicket}
                    disabled={citizenLoading}
                    className="text-xs py-1 px-2 h-auto"
                  >
                    {t('common.refresh')}
                  </Button>
                </div>

                <div className="pt-1">
                  {!isTerminalTicket ? (
                    <Button
                      id="btn-leave-queue"
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={onCancelTicket}
                      disabled={citizenLoading}
                      className="w-full text-xs shadow-2xs"
                    >
                      {t('tokenDesk.leaveQueueBtn')}
                    </Button>
                  ) : (
                    <Button
                      id="btn-take-new-token"
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={onDismissTicket}
                      className="w-full text-xs shadow-2xs"
                    >
                      {t('tokenDesk.takeNewTokenBtn')}
                    </Button>
                  )}
                </div>
              </div>
              </div>
            </div>

            {/* Staff counter controls strictly restricted to authorized staff/admin accounts */}
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'OPERATOR') && children}
          </div>
        ) : (
          /* STATE 4: LOADING / RECOVERING STATE */
          <div id="token-desk-loading" className="py-6 text-center space-y-2">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-700 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('tokenDesk.checkingTokenDetails')}
            </p>
            <div className="pt-1">
              <Button
                id="btn-reset-session"
                type="button"
                variant="outline"
                size="sm"
                onClick={onDismissTicket}
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                {t('tokenDesk.resetSessionBtn')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Advisory footnote */}
      <div className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2 leading-tight">
        QueuelessBharat Digital Token Desk &bull; Deterministic Telemetry
      </div>
    </Card>
  )
}

export default CitizenTokenDesk
