import type React from 'react'
import { useLanguage } from '../i18n'
import type { User } from '../types/auth'
import type { UserQueueStatusResponse } from '../types/queue'

interface OperatorDeskProps {
  currentUser: User | null
  userStatus: UserQueueStatusResponse
  citizenLoading: boolean
  operatorMessage: string | null
  operatorIsError: boolean
  onStartService: () => void
  onCompleteService: () => void
  onRefreshStatus: () => void
}

export const OperatorDesk: React.FC<OperatorDeskProps> = ({
  currentUser,
  userStatus,
  citizenLoading,
  operatorMessage,
  operatorIsError,
  onStartService,
  onCompleteService,
  onRefreshStatus,
}) => {
  const { t } = useLanguage()
  const isOperatorOrAdmin =
    currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN'

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/60">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
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
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('operator.advancesNotice')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          id="btn-operator-start"
          onClick={onStartService}
          disabled={citizenLoading || userStatus.session.status !== 'WAITING'}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
        >
          {t('operator.callIntoService')}
        </button>
        <button
          id="btn-operator-complete"
          onClick={onCompleteService}
          disabled={citizenLoading || userStatus.session.status !== 'IN_SERVICE'}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition cursor-pointer"
        >
          {t('operator.finishService')}
        </button>
        <button
          onClick={onRefreshStatus}
          disabled={citizenLoading}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          {t('operator.manualRefresh')}
        </button>
      </div>

      {operatorMessage && (
        <div
          id="operator-message"
          className={`mt-3 p-2.5 rounded-lg text-xs font-medium border ${
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
