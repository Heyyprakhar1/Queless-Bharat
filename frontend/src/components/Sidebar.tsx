import type React from 'react'
import { useLanguage } from '../i18n'

export type SidebarTab = 'home' | 'findServices' | 'myTokens' | 'nearbyCenters' | 'citizenGuide'

interface SidebarProps {
  activeTab: SidebarTab
  onSelectTab: (tab: SidebarTab) => void
  activeTokenCount?: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeTokenCount = 0,
}) => {
  const { t } = useLanguage()

  const navItems: Array<{
    id: SidebarTab
    label: string
    icon: (isActive: boolean) => React.ReactNode
    badge?: number
  }> = [
    {
      id: 'home',
      label: t('sidebar.home'),
      icon: (active) => (
        <svg
          className={`w-4 h-4 ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: 'findServices',
      label: t('sidebar.findServices'),
      icon: (active) => (
        <svg
          className={`w-4 h-4 ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      id: 'myTokens',
      label: t('sidebar.myTokens'),
      badge: activeTokenCount > 0 ? activeTokenCount : undefined,
      icon: (active) => (
        <svg
          className={`w-4 h-4 ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
          />
        </svg>
      ),
    },
    {
      id: 'nearbyCenters',
      label: t('sidebar.nearbyCenters'),
      icon: (active) => (
        <svg
          className={`w-4 h-4 ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      id: 'citizenGuide',
      label: t('sidebar.citizenGuide'),
      icon: (active) => (
        <svg
          className={`w-4 h-4 ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
  ]

  const handleNavClick = (id: SidebarTab) => {
    onSelectTab(id)

    // Smooth scroll to relevant parts of the page for high usability
    if (id === 'myTokens') {
      const el = document.getElementById('citizen-token-desk-section')
      el?.scrollIntoView({ behavior: 'smooth' })
    } else if (id === 'findServices' || id === 'home') {
      const el = document.getElementById('service-discovery-heading')
      el?.scrollIntoView({ behavior: 'smooth' })
    } else if (id === 'nearbyCenters') {
      const el = document.getElementById('facility-spatial-card')
      el?.scrollIntoView({ behavior: 'smooth' })
    } else if (id === 'citizenGuide') {
      const el = document.getElementById('smart-visit-planner-section')
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside
        aria-label="Civic Navigation"
        className="hidden lg:flex flex-col justify-between w-52 xl:w-56 shrink-0 border-r border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 transition-colors"
      >
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-2">
            Navigation
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none text-left ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 shadow-2xs border border-blue-200/70 dark:border-blue-900/70'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    {item.icon(isActive)}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-700 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Civic Telemetry Footer inside Sidebar */}
        <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2">
          <div className="flex items-center space-x-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('sidebar.systemStatus')}</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 px-2 leading-tight">
            Digital India &bull; 20 Urban Markets
          </div>
        </div>
      </aside>

      {/* Mobile Horizontal Navigation Tab Strip */}
      <nav
        aria-label="Mobile Civic Navigation"
        className="flex lg:hidden overflow-x-auto no-scrollbar gap-1 p-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap cursor-pointer select-none shrink-0 ${
                isActive
                  ? 'bg-blue-700 text-white shadow-2xs font-semibold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {item.icon(isActive)}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-blue-700">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}

export default Sidebar
