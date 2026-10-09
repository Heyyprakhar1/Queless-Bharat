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
        <div className="flex justify-center text-slate-400">{icon}</div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/80 mx-auto flex items-center justify-center text-slate-500 font-bold text-lg">
          Q
        </div>
      )}
      <div className="space-y-1">
        <h4 className="text-sm sm:text-base font-bold text-slate-900">{title}</h4>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
