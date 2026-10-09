import type React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wide',
    md: 'text-xs px-2.5 py-1 rounded-md font-semibold',
  }[size]

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    primary: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200',
    purple: 'bg-purple-50 text-purple-800 border border-purple-200',
  }[variant]

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
