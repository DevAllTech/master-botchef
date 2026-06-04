import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'sent' | 'received' | 'connected' | 'disconnected' | 'default'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'sent' && 'bg-blue-100 text-blue-700',
        variant === 'received' && 'bg-purple-100 text-purple-700',
        variant === 'connected' && 'bg-green-100 text-green-700',
        variant === 'disconnected' && 'bg-red-100 text-red-700',
        variant === 'default' && 'bg-gray-100 text-gray-700',
        className,
      )}
    >
      {children}
    </span>
  )
}
