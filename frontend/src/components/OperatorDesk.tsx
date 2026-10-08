import type React from 'react'
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
  const isOperatorOrAdmin =
    currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN'

  return (
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
          onClick={onStartService}
          disabled={citizenLoading || userStatus.session.status !== 'WAITING'}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer"
        >
          Call into Service (Start)
        </button>
        <button
          id="btn-operator-complete"
          onClick={onCompleteService}
          disabled={citizenLoading || userStatus.session.status !== 'IN_SERVICE'}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition cursor-pointer"
        >
          Finish Service (Complete)
        </button>
        <button
          onClick={onRefreshStatus}
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
  )
}
