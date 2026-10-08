import type React from 'react'
import type { User } from '../types/auth'

interface HeaderProps {
  isHealthy: boolean
  currentUser: User | null
  onLogout: () => void
  onOpenAuth: () => void
  onQuickLogin: (email: string, pass: string) => void
}

export const Header: React.FC<HeaderProps> = ({
  isHealthy,
  currentUser,
  onLogout,
  onOpenAuth,
  onQuickLogin,
}) => {
  return (
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
                onClick={onLogout}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 ml-2 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                id="btn-open-auth"
                onClick={onOpenAuth}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition cursor-pointer"
              >
                Sign In
              </button>
              <div className="hidden sm:flex items-center space-x-1 text-xs">
                <span className="text-slate-400">| Quick:</span>
                <button
                  id="btn-demo-citizen"
                  onClick={() => onQuickLogin('citizen@queless.gov.in', 'CitizenPass123!')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                >
                  Citizen
                </button>
                <button
                  id="btn-demo-operator"
                  onClick={() => onQuickLogin('operator@queless.gov.in', 'OperatorPass123!')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                >
                  Operator
                </button>
                <button
                  id="btn-demo-admin"
                  onClick={() => onQuickLogin('admin@queless.gov.in', 'AdminPass123!')}
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
  )
}
