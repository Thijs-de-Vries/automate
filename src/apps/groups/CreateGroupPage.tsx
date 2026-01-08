/**
 * CreateGroupPage - Create a new group with name and icon selection
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { cn } from '@/lib/utils'
import { ArrowLeft, Check, Home } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { SPACE_ICONS } from '../../../convex/constants'

// Get icon component by name
function getIconComponent(iconName: string) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return icons[iconName] || LucideIcons.Circle
}

export default function CreateGroupPage() {
  const navigate = useNavigate()
  const createSpace = useMutation(api.spaces.createSpace)

  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('Users')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const spaceId = await createSpace({
        displayName: name.trim(),
        iconName: selectedIcon,
      })
      navigate(`/groups/${spaceId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/groups')}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            'bg-[var(--surface)] hover:bg-[var(--surface-hover)]',
            'border border-[var(--border)] transition-colors'
          )}
          title="Back to groups"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">Create Group</h2>
          <p className="text-[var(--muted)] text-sm">
            Share automations with family and friends
          </p>
        </div>
        <Link
          to="/"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            'bg-[var(--surface)] hover:bg-[var(--surface-hover)]',
            'border border-[var(--border)] transition-colors'
          )}
          title="Back to app"
        >
          <Home className="h-5 w-5" />
        </Link>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Name input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What would you like to call this group?
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Family, Roommates, Trip to Paris..."
            className={cn(
              'w-full px-4 py-3 rounded-xl',
              'bg-[var(--surface)] border border-[var(--border)]',
              'focus:outline-none focus:border-[var(--primary)]',
              'placeholder:text-[var(--muted)]',
              'text-lg'
            )}
            autoFocus
          />
        </div>

        {/* Icon selection */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Choose an icon
          </label>
          <div className="grid grid-cols-8 gap-2">
            {SPACE_ICONS.map((iconName) => {
              const Icon = getIconComponent(iconName)
              const isSelected = selectedIcon === iconName

              return (
                <button
                  key={iconName}
                  onClick={() => setSelectedIcon(iconName)}
                  className={cn(
                    'flex items-center justify-center w-11 h-11 rounded-xl',
                    'transition-all duration-150',
                    isSelected
                      ? 'bg-[var(--primary)] text-white scale-110 shadow-lg shadow-[var(--primary-glow)]'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div className={cn(
          'flex items-center gap-4 p-4 rounded-xl',
          'bg-[var(--surface)] border border-[var(--border)]'
        )}>
          <div className={cn(
            'flex items-center justify-center w-14 h-14 rounded-xl',
            'bg-[var(--primary-muted)]'
          )}>
            {(() => {
              const PreviewIcon = getIconComponent(selectedIcon)
              return <PreviewIcon className="h-7 w-7 text-[var(--primary)]" />
            })()}
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Preview</p>
            <h3 className="font-semibold text-lg">
              {name.trim() || 'Your Group Name'}
            </h3>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={isCreating || !name.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
            'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
            'text-white font-medium',
            'transition-all duration-200 shadow-lg shadow-[var(--primary-glow)]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isCreating ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="h-5 w-5" />
              <span>Create Group</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
