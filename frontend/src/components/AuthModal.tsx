import type React from 'react'
import { useLanguage } from '../i18n'
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
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 max-w-md w-full overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="civic-tricolour-hairline" />
        <div className="p-6 space-y-5">
          {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
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
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              {t('authModal.citizenAccessTab')}
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
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              {t('authModal.staffPortalTab')}
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
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              {t('authModal.passwordRegisterTab')}
            </button>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 font-bold text-xl cursor-pointer p-1"
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
            title={t('authModal.authNotice')}
            onClose={onClearAuthError}
          >
            {authError}
          </Alert>
        )}

        {/* TAB 1: GOOGLE CITIZEN IDENTITY VERIFICATION */}
        {activeTab === 'citizen' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 inline-block" />
                {t('authModal.verifiedCitizenEntry')}
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('authModal.verifiedCitizenEntryDesc')}
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

            <div className="pt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
              {t('authModal.openIdScopeNote')}
            </div>
          </div>
        )}

        {/* TAB 2: STAFF PORTAL (EMAIL + PASSWORD, BACKEND ROLE DERIVATION) */}
        {activeTab === 'staff' && (
          <form onSubmit={onSubmitStaffLogin} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              {t('authModal.staffPortalNotice')}
            </div>

            <div>
              <label
                htmlFor="input-login-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('authModal.staffEmailLabel')}
              </label>
              <input
                id="input-login-email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="operator@queless.gov.in"
                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="input-login-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('authModal.passwordLabel')}
              </label>
              <input
                id="input-login-password"
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Button
              id="btn-submit-login"
              type="submit"
              variant="primary"
              size="md"
              disabled={authLoading}
              isLoading={authLoading}
              loadingText={t('authModal.signingIn')}
              className="w-full justify-center"
            >
              {t('authModal.signInStaffBtn')}
            </Button>
          </form>
        )}

        {/* TAB 3: CITIZEN PASSWORD REGISTRATION (SECONDARY) */}
        {activeTab === 'register' && (
          <form onSubmit={onSubmitRegister} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              {t('authModal.passwordRegisterNotice')}
            </div>

            <div>
              <label
                htmlFor="input-register-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('authModal.fullNameLabel')}
              </label>
              <input
                id="input-register-name"
                type="text"
                required
                value={authFullName}
                onChange={(e) => setAuthFullName(e.target.value)}
                placeholder="e.g. Priya Patel"
                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="input-register-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('authModal.emailAddressLabel')}
              </label>
              <input
                id="input-register-email"
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="priya@example.com"
                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="input-register-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('authModal.passwordMinChars')}
              </label>
              <input
                id="input-register-password"
                type="password"
                required
                minLength={8}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Button
              id="btn-submit-register"
              type="submit"
              variant="primary"
              size="md"
              disabled={authLoading}
              isLoading={authLoading}
              loadingText={t('authModal.creatingAccount')}
              className="w-full justify-center"
            >
              {t('authModal.createAccountBtn')}
            </Button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}
