import { useNavigate } from 'react-router-dom'
import { GripVertical, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AutomationConfig } from '@/config/automations'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface AutomationCardProps {
  automation: AutomationConfig
  isFavorite?: boolean
  onToggleFavorite?: () => void
  isDraggable?: boolean
  variant?: 'default' | 'compact'
}

export function AutomationCard({
  automation,
  isFavorite = false,
  onToggleFavorite,
  isDraggable = false,
  variant = 'default',
}: AutomationCardProps) {
  const navigate = useNavigate()
  const Icon = automation.icon

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: automation.id,
    disabled: !isDraggable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleClick = () => {
    navigate(automation.route)
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite?.()
  }

  if (variant === 'compact') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-3 p-3 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-200',
          'bg-[var(--surface)] border border-[var(--border)]',
          'hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)]',
          isDragging && 'opacity-50 scale-105 shadow-2xl z-50'
        )}
        onClick={handleClick}
      >
        {isDraggable && (
          <button
            className="touch-none cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            'bg-[var(--primary-muted)]'
          )}
        >
          <Icon className={cn('h-4 w-4', automation.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{automation.name}</p>
          <p className="text-xs text-[var(--muted)] truncate">
            {automation.description}
          </p>
        </div>
        {onToggleFavorite && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              'p-1.5 rounded-md transition-all duration-200',
              isFavorite
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-[var(--muted)] hover:text-[var(--foreground)] opacity-100 group-hover:opacity-100'
            )}
          >
            <Star
              className="h-4 w-4"
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative p-4 rounded-[var(--radius)] cursor-pointer transition-all duration-200',
        'bg-[var(--surface)] border border-[var(--border)]',
        'hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary-glow)]',
        'active:scale-[0.98]',
        isDragging && 'opacity-50 scale-105 shadow-2xl z-50'
      )}
      onClick={handleClick}
    >
      {isDraggable && (
        <button
          className="absolute top-2 left-2 touch-none cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] transition-colors opacity-100 group-hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      
      {onToggleFavorite && (
        <button
          onClick={handleFavoriteClick}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-md transition-all duration-200',
            isFavorite
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-[var(--muted)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100'
          )}
        >
          <Star
            className="h-4 w-4"
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      )}

      <div className="flex flex-col items-center text-center pt-2">
        <div
          className={cn(
            'flex items-center justify-center w-14 h-14 rounded-2xl mb-3',
            'bg-gradient-to-br from-[var(--primary-muted)] to-transparent',
            'border border-[var(--primary)]/20'
          )}
        >
          <Icon className={cn('h-7 w-7', automation.color)} />
        </div>
        <h3 className="font-semibold text-[var(--foreground)] mb-1">
          {automation.name}
        </h3>
        <p className="text-xs text-[var(--muted)] line-clamp-2">
          {automation.description}
        </p>
      </div>
    </div>
  )
}
