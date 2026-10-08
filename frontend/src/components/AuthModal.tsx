import type React from 'react'
import type { UserRole } from '../types/auth'

interface AuthModalProps {
  isOpen: boolean
  mode: 'login' | 'register'
  onClose: () => void
  onModeChange: (mode: 'login' | 'register') => void
  authEmail: string
  setAuthEmail: (email: string) => void
  authPassword: string
  setAuthPassword: (pwd: string) => void
  authFullName: string
  setAuthFullName: (name: string) => void
  authRole: UserRole
  setAuthRole: (role: UserRole) => void
  authLoading: boolean
  authError: string | null
  onSubmitLogin: (e: React.FormEvent) => void
  onSubmitRegister: (e: React.FormEvent) => void
  onQuickLogin: (email: string, pass: string) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onModeChange,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authFullName,
  setAuthFullName,
  authRole,
  setAuthRole,
  authLoading,
  authError,
  onSubmitLogin,
  onSubmitRegister,
  onQuickLogin,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex space-x-3">
            <button
              id="tab-login"
              type="button"
              onClick={() => onModeChange('login')}
              className={`text-sm font-bold pb-1 cursor-pointer transition ${
                mode === 'login'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-register"
              type="button"
              onClick={() => onModeChange('register')}
              className={`text-sm font-bold pb-1 cursor-pointer transition ${
                mode === 'register'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            &times;
          </button>
        </div>

        {authError && (
          <div id="auth-error-msg" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <strong>Authentication error:</strong> {authError}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={onSubmitLogin} className="space-y-4">
            <div>
              <label htmlFor="input-login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="input-login-email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="input-login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                id="input-login-password"
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="pt-2 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400 block mb-2">Or select a demo account:</span>
              <div className="flex flex-col gap-1.5">
                <button
                  id="btn-modal-demo-citizen"
                  type="button"
                  onClick={() => onQuickLogin('citizen@queless.gov.in', 'CitizenPass123!')}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer text-left flex justify-between items-center"
                >
                  <span>Citizen (Amit Sharma)</span>
                  <span className="text-[10px] text-slate-400 font-mono">citizen@queless.gov.in</span>
                </button>
                <button
                  id="btn-modal-demo-operator"
                  type="button"
                  onClick={() => onQuickLogin('operator@queless.gov.in', 'OperatorPass123!')}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer text-left flex justify-between items-center"
                >
                  <span>Operator (Rajesh)</span>
                  <span className="text-[10px] text-slate-400 font-mono">operator@queless.gov.in</span>
                </button>
                <button
                  id="btn-modal-demo-admin"
                  type="button"
                  onClick={() => onQuickLogin('admin@queless.gov.in', 'AdminPass123!')}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer text-left flex justify-between items-center"
                >
                  <span>System Admin</span>
                  <span className="text-[10px] text-slate-400 font-mono">admin@queless.gov.in</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmitRegister} className="space-y-4">
            <div>
              <label htmlFor="input-register-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="input-register-name"
                type="text"
                required
                value={authFullName}
                onChange={(e) => setAuthFullName(e.target.value)}
                placeholder="e.g. Priya Patel"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="input-register-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="input-register-email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="priya@example.com"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="input-register-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password (min 8 chars)
              </label>
              <input
                id="input-register-password"
                type="password"
                required
                minLength={8}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="select-register-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Account Role
              </label>
              <select
                id="select-register-role"
                value={authRole}
                disabled
                onChange={(e) => setAuthRole(e.target.value as UserRole)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 text-slate-600 cursor-not-allowed"
              >
                <option value="CITIZEN">CITIZEN (Public queue participant)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Public registration securely provisions CITIZEN role. Privileged operator and administrative roles are provisioned through admin management.
              </p>
            </div>

            <button
              id="btn-submit-register"
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
