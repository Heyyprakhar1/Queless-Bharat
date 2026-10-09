import type React from 'react'
import type { User } from '../types/auth'

interface HeaderProps {
  isHealthy: boolean
  currentUser: User | null
  currentWorkspace: 'citizen' | 'staff'
  onSelectWorkspace: (ws: 'citizen' | 'staff') => void
  onLogout: () => void
  onOpenCitizenAccess: () => void
  onOpenStaffPortal: () => void
}

export const Header: React.FC<HeaderProps> = ({
  isHealthy,
  currentUser,
  currentWorkspace,
  onSelectWorkspace,
  onLogout,
  onOpenCitizenAccess,
  onOpenStaffPortal,
}) => {
  const isStaff = currentUser?.role === 'OPERATOR' || currentUser?.role === 'ADMIN'

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Logo and Tagline */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-xs">
              Q
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                  QueueLess Bharat
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  20 Urban Markets
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Deterministic Waiting for Indian Civic Services
              </p>
            </div>
          </div>

          {/* Health indicator on mobile */}
          <div className="flex sm:hidden items-center space-x-1.5 text-xs text-slate-500">
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px]">{isHealthy ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        {/* Center / Navigation Switcher (for Staff) */}
        {isStaff && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              id="tab-view-citizen"
              type="button"
              onClick={() => onSelectWorkspace('citizen')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                currentWorkspace === 'citizen'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Citizen Portal
            </button>
            <button
              id="tab-view-staff"
              type="button"
              onClick={() => onSelectWorkspace('staff')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                currentWorkspace === 'staff'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {currentUser?.role === 'ADMIN' ? 'Admin Workspace' : 'Operator Desk'}
            </button>
          </div>
        )}

        {/* User Auth Section in Header */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 mr-1">
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>{isHealthy ? 'System Online' : 'System Offline'}</span>
          </div>

          {currentUser ? (
            <div className="flex items-center space-x-2 bg-slate-100 py-1 px-3 rounded-lg border border-slate-200">
              <span id="auth-user-badge" className="text-xs font-semibold text-slate-800">
                {currentUser.full_name || currentUser.email}
              </span>
              <span
                id="auth-role-badge"
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : currentUser.role === 'OPERATOR'
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'bg-blue-100 text-blue-900 border border-blue-300'
                }`}
              >
                {currentUser.role}
              </span>
              <button
                id="btn-logout"
                type="button"
                onClick={onLogout}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 ml-2 cursor-pointer transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                id="btn-open-citizen-access"
                type="button"
                onClick={onOpenCitizenAccess}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-lg transition border border-slate-200 cursor-pointer"
              >
                Citizen Access
              </button>
              <button
                id="btn-open-auth"
                type="button"
                onClick={onOpenStaffPortal}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <span>Staff Portal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
