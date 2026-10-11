import type React from 'react'
import { useLanguage } from '../i18n'

export const Footer: React.FC = () => {
  const { t } = useLanguage()

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 transition-colors duration-150">
      <div className="max-w-6xl mx-auto px-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
        <div>{t('footer.title')}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500">
          {t('footer.subtitle')}
        </div>
      </div>
    </footer>
  )
}
