import type React from 'react'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral'
  title?: string
  onClose?: () => void
  children: React.ReactNode
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  onClose,
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    info: 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200',
    success: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200',
    warning: 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200',
    error: 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200',
    neutral: 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200',
  }[variant]

  const titleStyles = {
    info: 'text-blue-950 dark:text-blue-100',
    success: 'text-emerald-950 dark:text-emerald-100',
    warning: 'text-amber-950 dark:text-amber-100',
    error: 'text-rose-950 dark:text-rose-100',
    neutral: 'text-slate-900 dark:text-slate-100',
  }[variant]

  return (
    <div
      role="alert"
      className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-3 ${variantStyles} ${className}`}
      {...props}
    >
      <div className="space-y-0.5">
        {title && <div className={`font-bold ${titleStyles}`}>{title}</div>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 font-bold text-base cursor-pointer px-1 -mt-1"
          aria-label="Dismiss alert"
        >
          &times;
        </button>
      )}
    </div>
  )
}
