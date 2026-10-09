import type React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
    md: 'text-sm px-4 py-2 rounded-xl gap-2',
    lg: 'text-base px-6 py-2.5 rounded-xl gap-2.5',
  }[size]

  const variantStyles = {
    primary:
      'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs focus-visible:ring-indigo-500',
    secondary:
      'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200/80 focus-visible:ring-slate-400',
    outline:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs focus-visible:ring-indigo-500',
    danger:
      'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus-visible:ring-rose-500',
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 focus-visible:ring-slate-400',
  }[variant]

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-0.5 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {isLoading && loadingText ? loadingText : children}
    </button>
  )
}
