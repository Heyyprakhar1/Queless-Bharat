import type React from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`text-center py-10 px-4 max-w-md mx-auto space-y-3 ${className}`}
    >
      {icon ? (
        <div className="flex justify-center text-slate-400 dark:text-slate-500">{icon}</div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-lg">
          Q
        </div>
      )}
      <div className="space-y-1">
        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{title}</h4>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
