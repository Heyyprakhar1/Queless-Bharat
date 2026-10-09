import type React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'flat' | 'outline' | 'subtle'
  className?: string
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    elevated: 'bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors',
    flat: 'bg-white border border-slate-200',
    outline: 'bg-transparent border border-slate-300',
    subtle: 'bg-slate-50 border border-slate-200/70',
  }[variant]

  return (
    <div
      className={`rounded-2xl p-6 ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`space-y-1 pb-4 border-b border-slate-100 ${className}`} {...props}>
    {children}
  </div>
)

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-base sm:text-lg font-bold text-slate-900 tracking-tight ${className}`} {...props}>
    {children}
  </h3>
)

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs sm:text-sm text-slate-500 font-medium ${className}`} {...props}>
    {children}
  </p>
)

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`pt-4 ${className}`} {...props}>
    {children}
  </div>
)

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3 ${className}`} {...props}>
    {children}
  </div>
)
