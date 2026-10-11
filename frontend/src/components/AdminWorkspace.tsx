import type React from 'react'
import { useLanguage } from '../i18n'
import type { User } from '../types/auth'
import type { Location } from '../types/queue'

interface AdminWorkspaceProps {
  currentUser: User
  cities: string[]
  facilities: Location[]
  selectedCity: string
  onSelectCity: (city: string) => void
  onRefreshData: () => void
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  currentUser,
  cities,
  facilities,
  selectedCity,
  onSelectCity,
  onRefreshData,
}) => {
  const { t } = useLanguage()

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {t('admin.heading')}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {t('admin.badge')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.subheading')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('admin.loggedInAs')} <strong>{currentUser.full_name || currentUser.email}</strong>
          </span>
          <button
            type="button"
            onClick={onRefreshData}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            {t('admin.refreshTelemetry')}
          </button>
        </div>
      </div>

      {/* High-level system KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.marketsCovered')}
          </span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {cities.length > 0 ? cities.length : 20}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('admin.tier1Tier2')}</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.facilitiesActive')}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {facilities.length > 0 ? facilities.length : '—'}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('admin.inSelectedCity', { city: selectedCity })}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.deterministicEngine')}
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {t('admin.active')}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('admin.empiricalWeighted')}</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.securityRbac')}
          </span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {t('admin.strict')}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('admin.bolaEnforced')}</span>
        </div>
      </div>

      {/* Facilities Table in Current City */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t('admin.configuredFacilities', { city: selectedCity })}
          </h3>
          <select
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">{t('admin.colFacility')}</th>
                <th className="px-4 py-2.5">{t('admin.colCategory')}</th>
                <th className="px-4 py-2.5">{t('admin.colAddress')}</th>
                <th className="px-4 py-2.5">{t('admin.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {facilities.map((fac) => (
                <tr key={fac.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{fac.name}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-700 dark:text-slate-300">
                    {t(`categories.${fac.category}`) !== `categories.${fac.category}`
                      ? t(`categories.${fac.category}`)
                      : fac.category.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{fac.address}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      {fac.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
