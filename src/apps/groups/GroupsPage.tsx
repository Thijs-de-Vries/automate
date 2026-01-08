/**
 * GroupsPage - List and manage all user's groups
 */

import { Link } from 'react-router-dom'
import { useSpace } from '@/contexts/SpaceContext'
import { cn } from '@/lib/utils'
import { Plus, ChevronRight, Users, Crown, Shield, User, ArrowLeft } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

// Get icon component by name
function getIconComponent(iconName: string) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return icons[iconName] || LucideIcons.Circle
}

function getRoleBadge(role: string) {
  switch (role) {
    case 'creator':
      return { icon: Crown, label: 'Creator', color: 'text-amber-400' }
    case 'admin':
      return { icon: Shield, label: 'Admin', color: 'text-blue-400' }
    default:
      return { icon: User, label: 'Member', color: 'text-[var(--muted)]' }
  }
}

export default function GroupsPage() {
  const { spaces, isLoading } = useSpace()

  if (isLoading) {
    return (
      <div className="space-y-4 py-6">
        <div className="h-8 w-48 bg-[var(--surface)] rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[var(--surface)] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            'bg-[var(--surface)] hover:bg-[var(--surface-hover)]',
            'border border-[var(--border)] transition-colors'
          )}
          title="Back to app"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">Groups</h2>
          <p className="text-[var(--muted)] text-sm">
            Manage your personal and shared groups
          </p>
        </div>
        <Link
          to="/groups/new"
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
            'text-white font-medium text-sm',
            'transition-all duration-200 shadow-lg shadow-[var(--primary-glow)]'
          )}
        >
          <Plus className="h-4 w-4" />
          <span>New Group</span>
        </Link>
      </div>

      {/* Join with code */}
      <div className={cn(
        'flex items-center gap-3 p-4 rounded-xl',
        'bg-[var(--surface)] border border-[var(--border)]'
      )}>
        <Users className="h-5 w-5 text-[var(--muted)]" />
        <div className="flex-1">
          <p className="text-sm font-medium">Have an invite code?</p>
          <p className="text-xs text-[var(--muted)]">Join a group shared by family or friends</p>
        </div>
        <Link
          to="/join/enter"
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium',
            'bg-[var(--surface-hover)] hover:bg-[var(--border)]',
            'transition-colors'
          )}
        >
          Enter Code
        </Link>
      </div>

      {/* Groups list */}
      <div className="space-y-3">
        {spaces.map((space) => {
          const Icon = getIconComponent(space.iconName)
          const roleBadge = getRoleBadge(space.role)
          const RoleIcon = roleBadge.icon

          return (
            <Link
              key={space._id}
              to={`/groups/${space._id}`}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl',
                'bg-[var(--surface)] border border-[var(--border)]',
                'hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]',
                'transition-all duration-200 group'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl',
                'bg-[var(--primary-muted)]'
              )}>
                <Icon className="h-6 w-6 text-[var(--primary)]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{space.displayName}</h3>
                  {space.isPersonal && (
                    <span className="text-xs text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--background)]">
                      Personal
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <RoleIcon className={cn('h-3 w-3', roleBadge.color)} />
                  <span className={cn('text-xs', roleBadge.color)}>{roleBadge.label}</span>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors" />
            </Link>
          )
        })}
      </div>

      {spaces.length === 0 && (
        <div className={cn(
          'flex flex-col items-center justify-center py-16',
          'border-2 border-dashed border-[var(--border)] rounded-2xl'
        )}>
          <Users className="h-12 w-12 text-[var(--muted)] mb-4" />
          <h3 className="font-semibold text-lg mb-1">No groups yet</h3>
          <p className="text-[var(--muted)] text-sm text-center mb-4">
            Create your first group to get started
          </p>
        </div>
      )}
    </div>
  )
}
