import type React from 'react'
import { GoogleSignInButton } from './GoogleSignInButton'
import { Alert, Button } from './ui'

interface AuthModalProps {
  isOpen: boolean
  activeTab: 'citizen' | 'staff' | 'register'
  onClose: () => void
  onTabChange: (tab: 'citizen' | 'staff' | 'register') => void
  // Google Citizen Sign-In
  googleClientId: string | null
  onGoogleSignIn: (idToken: string) => Promise<void> | void
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
  onClearAuthError?: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
  googleClientId,
  onGoogleSignIn,
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
  onClearAuthError,
}) => {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 max-w-md w-full p-6 space-y-5">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex space-x-2 sm:space-x-4">
            <button
              id="tab-citizen"
              type="button"
              onClick={() => {
                if (onClearAuthError) onClearAuthError()
                onTabChange('citizen')
              }}
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
              onClick={() => {
                if (onClearAuthError) onClearAuthError()
                onTabChange('staff')
              }}
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
              onClick={() => {
                if (onClearAuthError) onClearAuthError()
                onTabChange('register')
              }}
              className={`text-xs sm:text-sm font-bold pb-1 cursor-pointer transition ${
                activeTab === 'register'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Password Register
            </button>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer p-1"
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Error notification */}
        {authError && (
          <Alert
            id="auth-error-msg"
            variant="error"
            title="Authentication Notice"
            onClose={onClearAuthError}
          >
            {authError}
          </Alert>
        )}

        {/* TAB 1: GOOGLE CITIZEN IDENTITY VERIFICATION */}
        {activeTab === 'citizen' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                Verified Citizen Entry
              </div>
              <p className="text-slate-600 leading-relaxed">
                Sign in with Google to issue, track, and manage your civic queue tokens. QueueLess verifies your identity through Google OpenID Connect to prevent impersonation and spot-hoarding.
              </p>
            </div>

            <div className="pt-2">
              <GoogleSignInButton
                clientId={googleClientId}
                onSuccess={onGoogleSignIn}
                onError={(_msg) => {
                  if (onClearAuthError) onClearAuthError()
                }}
                isLoading={authLoading}
                disabled={authLoading}
              />
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-400">
              Only standard OpenID profile and email scopes are requested.
            </div>
          </div>
        )}

        {/* TAB 2: STAFF PORTAL (EMAIL + PASSWORD, BACKEND ROLE DERIVATION) */}
        {activeTab === 'staff' && (
          <form onSubmit={onSubmitStaffLogin} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900">Staff Portal:</span> For counter operators and system administrators. Enter assigned credentials. Permissions are verified strictly by the backend.
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

            <Button
              id="btn-submit-login"
              type="submit"
              variant="primary"
              size="md"
              disabled={authLoading}
              isLoading={authLoading}
              loadingText="Signing in..."
              className="w-full justify-center"
            >
              Sign In to Staff Portal
            </Button>
          </form>
        )}

        {/* TAB 3: CITIZEN PASSWORD REGISTRATION (SECONDARY) */}
        {activeTab === 'register' && (
          <form onSubmit={onSubmitRegister} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Password account registration is strictly unprivileged (<span className="font-semibold text-slate-800">CITIZEN role only</span>).
            </div>

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

            <Button
              id="btn-submit-register"
              type="submit"
              variant="primary"
              size="md"
              disabled={authLoading}
              isLoading={authLoading}
              loadingText="Creating account..."
              className="w-full justify-center"
            >
              Create Account
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
