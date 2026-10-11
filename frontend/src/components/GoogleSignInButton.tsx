import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useLanguage } from '../i18n'
import { Alert, Button } from './ui'

interface GoogleIdCredentialResponse {
  credential: string
  select_by?: string
}

declare global {
  interface Window {
    google?: any
    __queless_simulate_google_auth?: (idToken: string) => Promise<void>
  }
}

interface GoogleSignInButtonProps {
  clientId: string | null
  onSuccess: (idToken: string) => Promise<void> | void
  onError: (error: string) => void
  disabled?: boolean
  isLoading?: boolean
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  clientId,
  onSuccess,
  onError,
  disabled = false,
  isLoading = false,
}) => {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false)
  const [scriptError, setScriptError] = useState<boolean>(false)

  // Expose test automation hook for Playwright / E2E test runs
  useEffect(() => {
    window.__queless_simulate_google_auth = async (idToken: string) => {
      try {
        await onSuccess(idToken)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Google sign-in failed')
      }
    }
    return () => {
      delete window.__queless_simulate_google_auth
    }
  }, [onSuccess, onError])

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.google?.accounts?.id) {
      setScriptLoaded(true)
      return
    }

    const existingScript = document.getElementById('google-gsi-client')
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true))
      existingScript.addEventListener('error', () => setScriptError(true))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-client'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => setScriptError(true)
    document.head.appendChild(script)
  }, [])

  // Initialize and render GIS button when script & client_id are available
  useEffect(() => {
    if (!scriptLoaded || !clientId || !containerRef.current) return

    try {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleIdCredentialResponse) => {
          if (response?.credential) {
            onSuccess(response.credential)
          } else {
            onError('Google authentication did not return a valid credential.')
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      // Clear previous buttons before rendering
      containerRef.current.innerHTML = ''
      window.google?.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
      })
    } catch {
      // Catch GIS initialization issues gracefully
    }
  }, [scriptLoaded, clientId, onSuccess, onError])

  if (scriptError) {
    return (
      <Alert variant="error" title="Network Error">
        Could not load Google Identity Services library. Please check your internet connection or ad-blocker.
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {/* If Client ID is missing, show configuration-required warning banner */}
      {!clientId && (
        <Alert
          variant="warning"
          title={t('authModal.configRequiredTitle')}
        >
          {t('authModal.configRequiredDesc')}
        </Alert>
      )}

      {/* Container where Google GIS renders its official iframe/button */}
      {clientId && (
        <div
          id="google-signin-btn-container"
          ref={containerRef}
          className={`flex justify-center min-h-[44px] ${
            disabled || isLoading ? 'pointer-events-none opacity-50' : ''
          }`}
        />
      )}

      {/* Accessible native fallback / trigger button */}
      <div className="flex flex-col items-center">
        <Button
          id="btn-google-signin-fallback"
          type="button"
          variant="outline"
          size="md"
          disabled={disabled || isLoading}
          isLoading={isLoading}
          loadingText={t('authModal.verifyingGoogle')}
          onClick={() => {
            if (!clientId) {
              onError('Google OAuth Client ID is not configured. Please set GOOGLE_CLIENT_ID in backend or frontend.')
              return
            }
            if (window.google?.accounts?.id) {
              window.google.accounts.id.prompt()
            }
          }}
          className="w-full sm:w-80 justify-center border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 font-medium text-xs sm:text-sm py-2.5 rounded-xl shadow-2xs"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {t('authModal.continueGoogleFallback')}
        </Button>
      </div>
    </div>
  )
}
