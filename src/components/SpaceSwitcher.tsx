/**
 * SpaceSwitcher - Dropdown to switch between spaces (groups)
 */

import { useState, useRef, useEffect } from 'react'
import { useSpace, type Space } from '@/contexts/SpaceContext'
import { cn } from '@/lib/utils'
import { ChevronDown, Check, Plus, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as LucideIcons from 'lucide-react'

// Get icon component by name
function getIconComponent(iconName: string) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return icons[iconName] || LucideIcons.Circle
}

interface SpaceSwitcherProps {
  className?: string
}

export function SpaceSwitcher({ className }: SpaceSwitcherProps) {
  const { spaces, activeSpace, setActiveSpaceId, isLoading } = useSpace()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (isLoading || !activeSpace) {
    return (
      <div className={cn(
        'h-9 w-32 rounded-lg bg-[var(--surface)] animate-pulse',
        className
      )} />
    )
  }

  const ActiveIcon = getIconComponent(activeSpace.iconName)

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-[var(--surface)] hover:bg-[var(--surface-hover)]',
          'border border-[var(--border)]',
          'transition-colors duration-150',
          'text-sm font-medium'
        )}
      >
        <ActiveIcon className="h-4 w-4 text-[var(--primary)]" />
        <span className="max-w-[100px] truncate">{activeSpace.displayName}</span>
        <ChevronDown className={cn(
          'h-4 w-4 text-[var(--muted)] transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={cn(
          'absolute top-full left-0 mt-1 z-50',
          'min-w-[200px] py-1',
          'bg-[var(--surface)] border border-[var(--border)] rounded-xl',
          'shadow-xl shadow-black/20'
        )}>
          {/* Space list */}
          <div className="max-h-[300px] overflow-y-auto">
            {spaces.map((space) => (
              <SpaceItem
                key={space._id}
                space={space}
                isActive={space._id === activeSpace._id}
                onSelect={() => {
                  setActiveSpaceId(space._id)
                  setIsOpen(false)
                }}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-[var(--border)] my-1" />

          {/* Actions */}
          <Link
            to="/groups/new"
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 mx-1 rounded-lg',
              'text-sm text-[var(--muted)] hover:text-[var(--foreground)]',
              'hover:bg-[var(--surface-hover)] transition-colors'
            )}
          >
            <Plus className="h-4 w-4" />
            <span>Create group</span>
          </Link>
          <Link
            to="/groups"
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 mx-1 rounded-lg',
              'text-sm text-[var(--muted)] hover:text-[var(--foreground)]',
              'hover:bg-[var(--surface-hover)] transition-colors'
            )}
          >
            <Settings className="h-4 w-4" />
            <span>Manage groups</span>
          </Link>
        </div>
      )}
    </div>
  )
}

interface SpaceItemProps {
  space: Space
  isActive: boolean
  onSelect: () => void
}

function SpaceItem({ space, isActive, onSelect }: SpaceItemProps) {
  const Icon = getIconComponent(space.iconName)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 mx-1 rounded-lg',
        'text-sm text-left transition-colors',
        isActive
          ? 'bg-[var(--primary-muted)] text-[var(--foreground)]'
          : 'hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)]'
      )}
      style={{ width: 'calc(100% - 8px)' }}
    >
      <Icon className={cn(
        'h-4 w-4 flex-shrink-0',
        isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)]'
      )} />
      <span className="flex-1 truncate">{space.displayName}</span>
      {isActive && (
        <Check className="h-4 w-4 text-[var(--primary)] flex-shrink-0" />
      )}
      {space.isPersonal && (
        <span className="text-xs text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--surface)]">
          You
        </span>
      )}
    </button>
  )
}
