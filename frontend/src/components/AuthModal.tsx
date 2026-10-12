import React, { useState } from 'react'
import { requestStaffAccount } from '../api/auth'
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
  const [isStaffRequestMode, setIsStaffRequestMode] = useState<boolean>(false)
  const [departmentNote, setDepartmentNote] = useState<string>('')
  const [staffRequestSuccess, setStaffRequestSuccess] = useState<string | null>(null)
  const [staffRequestLoading, setStaffRequestLoading] = useState<boolean>(false)
  const [staffRequestError, setStaffRequestError] = useState<string | null>(null)

  const handleStaffRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffRequestLoading(true)
    setStaffRequestError(null)
    setStaffRequestSuccess(null)
    try {
      await requestStaffAccount({
        email: authEmail,
        password: authPassword,
        full_name: authFullName,
        department_note: departmentNote || undefined,
      })
      setStaffRequestSuccess(t('authModal.staffRequestSuccess'))
      setAuthPassword('')
    } catch (err) {
      setStaffRequestError(err instanceof Error ? err.message : 'Failed to submit staff request')
    } finally {
      setStaffRequestLoading(false)
    }
  }

  const fillOperatorDemo = () => {
    setAuthEmail('operator@queless.gov.in')
    setAuthPassword('OperatorPass123!')
    if (onClearAuthError) onClearAuthError()
  }

  const fillAdminDemo = () => {
    setAuthEmail('admin@queless.gov.in')
    setAuthPassword('AdminPass123!')
    if (onClearAuthError) onClearAuthError()
  }

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
            variant={
              authError.toLowerCase().includes('pending administrator approval') ||
              authError.toLowerCase().includes('inactive')
                ? 'warning'
                : 'error'
            }
            title={
              authError.toLowerCase().includes('pending administrator approval') ||
              authError.toLowerCase().includes('inactive')
                ? t('authModal.accountPendingTitle')
                : t('authModal.authNotice')
            }
            onClose={onClearAuthError}
          >
            {authError.toLowerCase().includes('pending administrator approval') ||
            authError.toLowerCase().includes('inactive')
              ? t('authModal.accountPendingDesc')
              : authError}
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
          <div className="space-y-4">
            {isStaffRequestMode ? (
              /* Sub-mode: Staff Access Request */
              <form onSubmit={handleStaffRequestSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold">{t('authModal.requestStaffHeading')}</div>
                  <p className="leading-relaxed">{t('authModal.requestStaffDesc')}</p>
                </div>

                {staffRequestSuccess && (
                  <Alert variant="success" title="Request Submitted">
                    {staffRequestSuccess}
                  </Alert>
                )}

                {staffRequestError && (
                  <Alert variant="error" title={t('common.error')}>
                    {staffRequestError}
                  </Alert>
                )}

                <div>
                  <label
                    htmlFor="input-staff-request-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t('authModal.fullNameLabel')}
                  </label>
                  <input
                    id="input-staff-request-name"
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kulkarni"
                    className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-staff-request-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t('authModal.staffEmailLabel')}
                  </label>
                  <input
                    id="input-staff-request-email"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="ramesh@queless.gov.in"
                    className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-staff-request-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t('authModal.passwordMinChars')}
                  </label>
                  <input
                    id="input-staff-request-password"
                    type="password"
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-staff-request-note"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t('authModal.departmentNoteLabel')}
                  </label>
                  <input
                    id="input-staff-request-note"
                    type="text"
                    value={departmentNote}
                    onChange={(e) => setDepartmentNote(e.target.value)}
                    placeholder={t('authModal.departmentNotePlaceholder')}
                    className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    id="btn-submit-staff-request"
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={staffRequestLoading}
                    isLoading={staffRequestLoading}
                    loadingText={t('authModal.submittingStaffRequest')}
                    className="w-full justify-center"
                  >
                    {t('authModal.submitStaffRequestBtn')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStaffRequestMode(false)
                      setStaffRequestSuccess(null)
                      setStaffRequestError(null)
                    }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer text-center py-1"
                  >
                    &larr; {t('authModal.backToStaffLogin')}
                  </button>
                </div>
              </form>
            ) : (
              /* Normal mode: Staff Sign-In */
              <form onSubmit={onSubmitStaffLogin} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  <p>{t('authModal.staffPortalNotice')}</p>
                  {/* Demo credentials quick-fills */}
                  <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80 space-y-1">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      {t('authModal.demoCredentialsNote')}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <button
                        id="btn-fill-operator-demo"
                        type="button"
                        onClick={fillOperatorDemo}
                        className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-semibold text-[11px] cursor-pointer transition shadow-2xs"
                      >
                        ⚡ {t('authModal.fillOperatorDemo')}
                      </button>
                      <button
                        id="btn-fill-admin-demo"
                        type="button"
                        onClick={fillAdminDemo}
                        className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-semibold text-[11px] cursor-pointer transition shadow-2xs"
                      >
                        ⚡ {t('authModal.fillAdminDemo')}
                      </button>
                    </div>
                  </div>
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

                <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    id="btn-switch-staff-request"
                    type="button"
                    onClick={() => {
                      setIsStaffRequestMode(true)
                      if (onClearAuthError) onClearAuthError()
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                  >
                    {t('authModal.dontHaveStaffAccount')} &rarr;
                  </button>
                </div>
              </form>
            )}
          </div>
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
