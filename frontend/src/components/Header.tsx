import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useTheme } from '../context/ThemeContext'
import { type Language, useLanguage } from '../i18n'
import type { User } from '../types/auth'
import { IndianFlag } from './ui'

interface HeaderProps {
  currentUser: User | null
  currentWorkspace: 'citizen' | 'staff'
  onSelectWorkspace: (ws: 'citizen' | 'staff') => void
  onLogout: () => void
  onOpenCitizenAccess: () => void
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  currentWorkspace,
  onSelectWorkspace,
  onLogout,
  onOpenCitizenAccess,
}) => {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const isAdmin = currentUser?.role === 'ADMIN'

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initials for avatar
  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'QB'
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 transition-colors duration-150">
      <div className="w-full px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Compact Logo & System Status */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-black text-base shadow-xs select-none shrink-0">
              Q
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {t('header.appTitle')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                {t('header.tagline')}
              </p>
            </div>
          </div>
        </div>

        {/* Center / Navigation Switcher (strictly for Admin role) */}
        {isAdmin && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              id="tab-view-citizen"
              type="button"
              onClick={() => onSelectWorkspace('citizen')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer select-none ${
                currentWorkspace === 'citizen'
                  ? 'bg-white dark:bg-slate-700 text-blue-800 dark:text-blue-200 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('header.citizenPortal')}
            </button>
            <button
              id="tab-view-staff"
              type="button"
              onClick={() => onSelectWorkspace('staff')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer select-none ${
                currentWorkspace === 'staff'
                  ? 'bg-white dark:bg-slate-700 text-blue-800 dark:text-blue-200 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('header.adminWorkspace')}
            </button>
          </div>
        )}

        {/* Right Section: Indian Flag, Language, Theme, and FAR RIGHT Profile Area */}
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
          {/* Indian Tricolour Flag SVG */}
          <div className="hidden sm:flex items-center" title="Bharat / India">
            <IndianFlag className="w-5 h-3.5 rounded-xs border border-slate-200 dark:border-slate-700 shadow-2xs" />
          </div>

          {/* Language Selector */}
          <div className="relative">
            <label htmlFor="language-select" className="sr-only">
              {t('header.selectLanguage')}
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              aria-label={t('header.selectLanguage')}
              className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="en">EN &bull; English</option>
              <option value="hi">HI &bull; हिन्दी</option>
              <option value="mr">MR &bull; मराठी</option>
            </select>
          </div>

          {/* Theme Toggle Button */}
          <button
            id="btn-toggle-theme"
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark'
                ? t('header.themeToggleToLight')
                : t('header.themeToggleToDark')
            }
            title={
              theme === 'dark'
                ? t('header.themeToggleToLight')
                : t('header.themeToggleToDark')
            }
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {theme === 'dark' ? (
              <svg
                className="w-4 h-4 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-slate-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          {/* FAR RIGHT: User Profile Tab / Actions */}
          {currentUser ? (
            <div ref={profileRef} className="relative">
              <div
                className="flex items-center space-x-2 bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-750 py-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer select-none"
                onClick={() => setProfileOpen((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setProfileOpen((prev) => !prev)
                  }
                }}
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                {/* Avatar with initials */}
                <div className="w-6 h-6 rounded-full bg-blue-700 dark:bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                  {getInitials(currentUser.full_name, currentUser.email)}
                </div>

                {/* Actual User Name */}
                <span
                  id="auth-user-badge"
                  className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[120px] truncate"
                  title={currentUser.full_name || currentUser.email}
                >
                  {currentUser.full_name || currentUser.email}
                </span>

                {/* Role Badge */}
                <span
                  id="auth-role-badge"
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded tracking-wide ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                      : currentUser.role === 'OPERATOR'
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                  }`}
                >
                  {currentUser.role}
                </span>

                {/* Dropdown Chevron */}
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    profileOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>

                {/* Always-visible Sign Out button inside tab for direct test & citizen access */}
                <button
                  id="btn-logout"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onLogout()
                  }}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 ml-1.5 pl-1.5 border-l border-slate-300 dark:border-slate-600 cursor-pointer transition select-none"
                >
                  {t('common.signOut')}
                </button>
              </div>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-2 z-50 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in slide-in-from-top-1 duration-100"
                >
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/80">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.full_name || 'Citizen'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      {currentUser.email}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="py-1 border-b border-slate-100 dark:border-slate-700/80">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWorkspace(
                            currentWorkspace === 'citizen' ? 'staff' : 'citizen'
                          )
                          setProfileOpen(false)
                        }}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
                      >
                        {currentWorkspace === 'citizen'
                          ? t('header.adminWorkspace')
                          : t('header.citizenPortal')}
                      </button>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false)
                        onLogout()
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold cursor-pointer"
                    >
                      {t('common.signOut')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Logged out state: Citizen Access button */
            <div className="flex items-center space-x-2">
              <button
                id="btn-open-citizen-access"
                type="button"
                onClick={onOpenCitizenAccess}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs rounded-xl transition shadow-xs cursor-pointer select-none"
              >
                {t('header.citizenAccess')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
