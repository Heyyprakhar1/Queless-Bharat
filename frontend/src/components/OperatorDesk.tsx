import type React from 'react'
import { useLanguage } from '../i18n'
import type { User } from '../types/auth'
import type {
  OperatorDeskResponse,
  QueueSession,
  Service,
  UserQueueStatusResponse,
} from '../types/queue'

interface OperatorDeskProps {
  currentUser: User | null
  deskData?: OperatorDeskResponse | null
  userStatus?: UserQueueStatusResponse | null
  services?: Service[]
  selectedServiceId?: string
  onSelectService?: (serviceId: string) => void
  citizenLoading?: boolean
  operatorMessage: string | null
  operatorIsError: boolean
  onStartService: (sessionId?: string) => void
  onCompleteService: (sessionId?: string) => void
  onRefreshStatus: () => void
}

export const OperatorDesk: React.FC<OperatorDeskProps> = ({
  currentUser,
  deskData,
  userStatus,
  services,
  selectedServiceId,
  onSelectService,
  citizenLoading = false,
  operatorMessage,
  operatorIsError,
  onStartService,
  onCompleteService,
  onRefreshStatus,
}) => {
  const { t } = useLanguage()
  const isOperatorOrAdmin =
    currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN'

  // Resolve active session (if any currently seated / in-service)
  const activeSession: QueueSession | null =
    deskData?.active_session ||
    (userStatus?.session.status === 'IN_SERVICE' ? userStatus.session : null)

  // Resolve waiting queue
  const waitingSessions: QueueSession[] =
    deskData?.waiting_sessions ||
    (userStatus?.session.status === 'WAITING' ? [userStatus.session] : [])

  const nextWaitingSession: QueueSession | null =
    waitingSessions.length > 0 ? waitingSessions[0] : null

  // Determine button enabled states
  // Start is enabled if authorized, not loading, desk is not occupied, and someone is waiting
  const canStartService =
    isOperatorOrAdmin &&
    !citizenLoading &&
    !activeSession &&
    Boolean(nextWaitingSession || userStatus?.session.status === 'WAITING')

  // Complete is enabled if authorized, not loading, and desk is currently occupied
  const canCompleteService =
    isOperatorOrAdmin &&
    !citizenLoading &&
    Boolean(activeSession || userStatus?.session.status === 'IN_SERVICE')

  const activeServiceTitle =
    deskData?.service?.name ||
    userStatus?.service?.name ||
    services?.find((s) => s.id === (selectedServiceId || currentUser?.assigned_service_id))?.name ||
    'Assigned Service Counter'

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/60 space-y-4">
      {/* 1. Header with Role & Assignment Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t('operator.heading')}
            </span>
            <span
              id="operator-role-indicator"
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                isOperatorOrAdmin
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}
            >
              {isOperatorOrAdmin
                ? t('operator.authorized', { role: currentUser?.role || '' })
                : t('operator.restricted', { role: currentUser?.role || 'Unauthenticated' })}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
            <span className="text-slate-400">Desk Service:</span>
            <strong className="text-blue-700 dark:text-blue-400">{activeServiceTitle}</strong>
          </div>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('operator.advancesNotice')}
        </span>
      </div>

      {/* Service Selector if unassigned or admin */}
      {!currentUser?.assigned_service_id && services && services.length > 0 && onSelectService && (
        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            Select Active Service Desk:
          </span>
          <select
            id="operator-service-select"
            value={selectedServiceId || ''}
            onChange={(e) => onSelectService(e.target.value)}
            className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          >
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Active Participant / Current Desk State */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Current Counter Status
        </div>
        {activeSession ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                COUNTER ACTIVE: IN SERVICE
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Serving now
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                {activeSession.user_id || 'Citizen Participant'}
              </div>
              <div className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                {activeSession.position
                  ? `#Q-${String(activeSession.position).padStart(3, '0')}`
                  : `TK-${activeSession.id.slice(0, 6).toUpperCase()}`}
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              Session Ref: {activeSession.id}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('operator.noParticipantTitle')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('operator.noParticipantDesc')}
            </p>
          </div>
        )}
      </div>

      {/* 3. Waiting Queue Section */}
      {(deskData || waitingSessions.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <span>Waiting in Queue ({waitingSessions.length})</span>
            {waitingSessions.length > 0 && (
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 lowercase">
                next in line: {nextWaitingSession?.user_id || 'Citizen'}
              </span>
            )}
          </div>

          {waitingSessions.length === 0 ? (
            <div className="p-3 text-center rounded-lg bg-slate-100/60 dark:bg-slate-800/40 text-xs text-slate-500 italic">
              No citizens currently waiting in line for this service.
            </div>
          ) : (
            <div
              id="operator-waiting-queue-list"
              className="space-y-1.5 max-h-52 overflow-y-auto pr-1"
            >
              {waitingSessions.map((session, idx) => {
                const position = session.position ?? idx + 1
                const tokenDisplay = `#Q-${String(position).padStart(3, '0')}`
                return (
                  <div
                    key={session.id}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900 shrink-0">
                        {tokenDisplay}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {session.user_id || 'Citizen Participant'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate">
                        ({session.id.slice(0, 8)})
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        WAITING
                      </span>
                      {isOperatorOrAdmin && !activeSession && idx === 0 && (
                        <button
                          type="button"
                          onClick={() => onStartService(session.id)}
                          disabled={citizenLoading}
                          className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
                        >
                          Call In
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Action Controls */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          id="btn-operator-start"
          type="button"
          onClick={() => onStartService(nextWaitingSession?.id)}
          disabled={!canStartService}
          title={
            !isOperatorOrAdmin
              ? t('operator.restricted', { role: currentUser?.role || 'Unauthenticated' })
              : undefined
          }
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {t('operator.callIntoService')}
        </button>
        <button
          id="btn-operator-complete"
          type="button"
          onClick={() => onCompleteService(activeSession?.id)}
          disabled={!canCompleteService}
          title={
            !isOperatorOrAdmin
              ? t('operator.restricted', { role: currentUser?.role || 'Unauthenticated' })
              : undefined
          }
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {t('operator.finishService')}
        </button>
        <button
          id="btn-operator-refresh"
          type="button"
          onClick={onRefreshStatus}
          disabled={citizenLoading}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          {t('operator.manualRefresh')}
        </button>
      </div>

      {/* 5. Feedback Notice */}
      {operatorMessage && (
        <div
          id="operator-message"
          className={`p-2.5 rounded-lg text-xs font-medium border ${
            operatorIsError
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {operatorMessage}
        </div>
      )}
    </div>
  )
}

export default OperatorDesk
