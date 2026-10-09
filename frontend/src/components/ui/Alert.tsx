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
    info: 'bg-indigo-50/70 border-indigo-200 text-indigo-900',
    success: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50/70 border-amber-200 text-amber-900',
    error: 'bg-rose-50/70 border-rose-200 text-rose-900',
    neutral: 'bg-slate-50 border-slate-200 text-slate-800',
  }[variant]

  const titleStyles = {
    info: 'text-indigo-950',
    success: 'text-emerald-950',
    warning: 'text-amber-950',
    error: 'text-rose-950',
    neutral: 'text-slate-900',
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
          className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer px-1 -mt-1"
          aria-label="Dismiss alert"
        >
          &times;
        </button>
      )}
    </div>
  )
}
