import type React from 'react'
import { useLanguage } from '../i18n'
import type { HealthResponse } from '../types/health'

interface HealthPanelProps {
  health: HealthResponse | null
  healthLoading: boolean
  healthError: string | null
  lastChecked: Date | null
  onCheckHealth: () => void
}

export const HealthPanel: React.FC<HealthPanelProps> = ({
  health,
  healthLoading,
  healthError,
  lastChecked,
  onCheckHealth,
}) => {
  const { t } = useLanguage()
  const isHealthy = health?.status === 'ok' && health?.database === 'connected'

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('health.title')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('health.subtitle')}
          </p>
        </div>
        <button
          onClick={onCheckHealth}
          disabled={healthLoading}
          className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
        >
          {healthLoading ? t('health.checkingBtn') : t('health.refreshBtn')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-700/60">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            {t('health.apiService')}
          </span>
          <div className="flex items-center space-x-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isHealthy
                  ? 'bg-emerald-500'
                  : healthError
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {healthError ? t('health.unreachable') : health?.status === 'ok' ? t('health.healthy') : t('health.degraded')}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-700/60">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            {t('health.dbService')}
          </span>
          <div className="flex items-center space-x-2">
            <span
              className={`w-3 h-3 rounded-full ${
                health?.database === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {health?.database === 'connected' ? t('health.connected') : t('health.unreachable')}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-700/60">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            {t('health.env')}
          </span>
          <div className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
            {health?.environment || 'Unknown'}
          </div>
        </div>
      </div>

      {healthError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm mb-4">
          <strong>Connection Error:</strong> {healthError}. Ensure backend is running.
        </div>
      )}

      <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
        <span>{t('health.autoPolling')}</span>
        {lastChecked && (
          <span>{t('health.lastChecked', { time: lastChecked.toLocaleTimeString() })}</span>
        )}
      </div>
    </div>
  )
}
