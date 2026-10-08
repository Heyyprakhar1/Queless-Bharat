import type React from 'react'

interface AuthModalProps {
  isOpen: boolean
  activeTab: 'citizen' | 'staff' | 'register'
  onClose: () => void
  onTabChange: (tab: 'citizen' | 'staff' | 'register') => void
  // Low-friction Citizen Access
  citizenName: string
  setCitizenName: (name: string) => void
  citizenEmail: string
  setCitizenEmail: (email: string) => void
  onSubmitCitizenAccess: (e: React.FormEvent) => void
  // Staff Portal Login
  authEmail: string
  setAuthEmail: (email: string) => void
  authPassword: string
  setAuthPassword: (pwd: string) => void
  onSubmitStaffLogin: (e: React.FormEvent) => void
  // Traditional Citizen Register
  authFullName: string
  setAuthFullName: (name: string) => void
  onSubmitRegister: (e: React.FormEvent) => void
  // Common states
  authLoading: boolean
  authError: string | null
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
  citizenName,
  setCitizenName,
  citizenEmail,
  setCitizenEmail,
  onSubmitCitizenAccess,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  onSubmitStaffLogin,
  authFullName,
  setAuthFullName,
  onSubmitRegister,
  authLoading,
  authError,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex space-x-2 sm:space-x-4">
            <button
              id="tab-citizen"
              type="button"
              onClick={() => onTabChange('citizen')}
              className={`text-xs sm:text-sm font-bold pb-1 cursor-pointer transition ${
                activeTab === 'citizen'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Citizen Access
            </button>
            <button
              id="tab-login"
              type="button"
              onClick={() => onTabChange('staff')}
              className={`text-xs sm:text-sm font-bold pb-1 cursor-pointer transition ${
                activeTab === 'staff'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Staff Portal
            </button>
            <button
              id="tab-register"
              type="button"
              onClick={() => onTabChange('register')}
              className={`text-xs sm:text-sm font-bold pb-1 cursor-pointer transition ${
                activeTab === 'register'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Register
            </button>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Error notification */}
        {authError && (
          <div
            id="auth-error-msg"
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs"
          >
            <strong>Authentication Error:</strong> {authError}
          </div>
        )}

        {/* TAB 1: LOW-FRICTION CITIZEN ACCESS */}
        {activeTab === 'citizen' && (
          <form onSubmit={onSubmitCitizenAccess} className="space-y-4">
            <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900">
              <span className="font-bold">Instant Citizen Entry:</span> No password required. Enter your full name and email to issue and manage digital queue tokens.
            </div>

            <div>
              <label
                htmlFor="input-citizen-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="input-citizen-name"
                type="text"
                required
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="input-citizen-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="input-citizen-email"
                type="email"
                required
                value={citizenEmail}
                onChange={(e) => setCitizenEmail(e.target.value)}
                placeholder="ramesh.patel@example.com"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              id="btn-submit-citizen-access"
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {authLoading ? 'Signing in...' : 'Continue as Citizen'}
            </button>
          </form>
        )}

        {/* TAB 2: STAFF PORTAL (EMAIL + PASSWORD, BACKEND ROLE DERIVATION) */}
        {activeTab === 'staff' && (
          <form onSubmit={onSubmitStaffLogin} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
              <span className="font-bold">Staff Access:</span> For counter operators and system administrators. Enter assigned work credentials. Roles are verified securely by the backend.
            </div>

            <div>
              <label
                htmlFor="input-login-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Staff Work Email
              </label>
              <input
                id="input-login-email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="operator@queless.gov.in"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="input-login-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
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
              {authLoading ? 'Signing in...' : 'Sign In to Staff Portal'}
            </button>
          </form>
        )}

        {/* TAB 3: TRADITIONAL CITIZEN REGISTRATION */}
        {activeTab === 'register' && (
          <form onSubmit={onSubmitRegister} className="space-y-4">
            <div>
              <label
                htmlFor="input-register-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
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
              <label
                htmlFor="input-register-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
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
              <label
                htmlFor="input-register-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
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
