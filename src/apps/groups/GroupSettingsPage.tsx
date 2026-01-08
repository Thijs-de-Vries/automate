/**
 * GroupSettingsPage - View and manage group settings, members, invites
 */

import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  UserMinus,
  Crown,
  Shield,
  User,
  Bell,
  BellOff,
  RefreshCw,
  AlertTriangle,
  LogOut,
  Home,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { SPACE_ICONS } from '../../../convex/spaces'
import { getNotifiableAutomations } from '@/config/automations'

// Get icon component by name
function getIconComponent(iconName: string) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  return icons[iconName] || LucideIcons.Circle
}

export default function GroupSettingsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const spaceDetails = useQuery(api.spaces.getSpaceDetails, {
    spaceId: groupId as Id<"spaces">,
  })

  if (!spaceDetails) {
    return (
      <div className="space-y-4 py-6">
        <div className="h-8 w-48 bg-[var(--surface)] rounded animate-pulse" />
        <div className="h-40 bg-[var(--surface)] rounded-xl animate-pulse" />
      </div>
    )
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
          <h2 className="text-2xl font-bold tracking-tight">{spaceDetails.displayName}</h2>
          <p className="text-[var(--muted)] text-sm">Group settings</p>
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

      {/* Settings sections */}
      <div className="space-y-6">
        <GroupInfoSection
          spaceId={groupId as Id<"spaces">}
          displayName={spaceDetails.displayName}
          iconName={spaceDetails.iconName}
          isPersonal={spaceDetails.isPersonal}
          role={spaceDetails.role}
        />

        <NotificationPrefsSection
          spaceId={groupId as Id<"spaces">}
          preferences={spaceDetails.notificationPreferences}
        />

        {!spaceDetails.isPersonal && (
          <>
            <MembersSection
              spaceId={groupId as Id<"spaces">}
              members={spaceDetails.members}
              myRole={spaceDetails.role}
            />

            {(spaceDetails.role === 'creator' || spaceDetails.role === 'admin') && (
              <InvitesSection
                spaceId={groupId as Id<"spaces">}
                invites={spaceDetails.invites}
              />
            )}

            <DangerZoneSection
              spaceId={groupId as Id<"spaces">}
              displayName={spaceDetails.displayName}
              isPersonal={spaceDetails.isPersonal}
              role={spaceDetails.role}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ============================================
// Group Info Section
// ============================================
function GroupInfoSection({
  spaceId,
  displayName,
  iconName,
  isPersonal,
  role,
}: {
  spaceId: Id<"spaces">
  displayName: string
  iconName: string
  isPersonal: boolean
  role: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(displayName)
  const [selectedIcon, setSelectedIcon] = useState(iconName)
  const updateSpace = useMutation(api.spaces.updateSpace)

  const canEdit = role === 'creator' || role === 'admin'
  const Icon = getIconComponent(iconName)

  const handleSave = async () => {
    await updateSpace({
      spaceId,
      displayName: name,
      iconName: selectedIcon,
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className={cn(
        'p-4 rounded-xl',
        'bg-[var(--surface)] border border-[var(--border)]'
      )}>
        <h3 className="font-semibold mb-4">Edit Group</h3>

        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(
              'w-full px-4 py-2 rounded-lg',
              'bg-[var(--background)] border border-[var(--border)]',
              'focus:outline-none focus:border-[var(--primary)]'
            )}
          />

          <div className="grid grid-cols-8 gap-2">
            {SPACE_ICONS.map((icon) => {
              const IconComp = getIconComponent(icon)
              const isSelected = selectedIcon === icon

              return (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg',
                    'transition-all duration-150',
                    isSelected
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
                  )}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-xl',
      'bg-[var(--surface)] border border-[var(--border)]'
    )}>
      <div className={cn(
        'flex items-center justify-center w-14 h-14 rounded-xl',
        'bg-[var(--primary-muted)]'
      )}>
        <Icon className="h-7 w-7 text-[var(--primary)]" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-lg">{displayName}</h3>
        {isPersonal && (
          <p className="text-xs text-[var(--muted)]">Your personal space</p>
        )}
      </div>
      {canEdit && !isPersonal && (
        <button
          onClick={() => setIsEditing(true)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)]"
        >
          Edit
        </button>
      )}
    </div>
  )
}

// ============================================
// Notification Preferences Section
// ============================================
function NotificationPrefsSection({
  spaceId,
  preferences,
}: {
  spaceId: Id<"spaces">
  preferences: { tasks: boolean; packing: boolean; transport: boolean; calisthenics: boolean }
}) {
  const updatePrefs = useMutation(api.spaces.updateNotificationPreferences)
  
  // Get notifiable automations from config
  const notifiableAutomations = getNotifiableAutomations()

  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-[var(--surface)] border border-[var(--border)]'
    )}>
      <h3 className="font-semibold mb-1">Notifications</h3>
      <p className="text-xs text-[var(--muted)] mb-4">
        Choose which updates you want to receive from this group
      </p>

      <div className="space-y-3">
        {notifiableAutomations.map((automation) => {
          const key = automation.notificationKey!
          const isEnabled = preferences[key]
          const Icon = automation.icon
          
          return (
            <div key={automation.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', automation.color)} style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{automation.name}</p>
                  <p className="text-xs text-[var(--muted)]">{automation.notificationDescription}</p>
                </div>
              </div>
              <button
                onClick={() => updatePrefs({ spaceId, module: key, enabled: !isEnabled })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                  'transition-colors',
                  isEnabled
                    ? 'bg-[var(--primary-muted)] text-[var(--primary)]'
                    : 'bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]'
                )}
              >
                {isEnabled ? (
                  <>
                    <Bell className="h-4 w-4" />
                    <span>On</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4" />
                    <span>Off</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// Members Section
// ============================================
function MembersSection({
  spaceId,
  members,
  myRole,
}: {
  spaceId: Id<"spaces">
  members: any[]
  myRole: string
}) {
  const updateRole = useMutation(api.spaces.updateMemberRole)
  const removeMember = useMutation(api.spaces.removeMember)

  const canManage = myRole === 'creator'

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'creator': return Crown
      case 'admin': return Shield
      default: return User
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'creator': return 'text-amber-400'
      case 'admin': return 'text-blue-400'
      default: return 'text-[var(--muted)]'
    }
  }

  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-[var(--surface)] border border-[var(--border)]'
    )}>
      <h3 className="font-semibold mb-1">Members</h3>
      <p className="text-xs text-[var(--muted)] mb-4">
        {members.length} {members.length === 1 ? 'member' : 'members'}
      </p>

      <div className="space-y-2">
        {members.map((member) => {
          const RoleIcon = getRoleIcon(member.role)
          const roleColor = getRoleColor(member.role)
          const displayName = member.userName || 'Unknown User'
          const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

          return (
            <div
              key={member._id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-hover)]"
            >
              {member.userImageUrl ? (
                <img 
                  src={member.userImageUrl} 
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--primary-muted)] flex items-center justify-center">
                  <span className="text-xs font-medium text-[var(--primary)]">{initials || '?'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                <div className="flex items-center gap-1">
                  <RoleIcon className={cn('h-3 w-3', roleColor)} />
                  <span className={cn('text-xs capitalize', roleColor)}>{member.role}</span>
                </div>
              </div>
              {canManage && member.role !== 'creator' && (
                <div className="flex gap-1">
                  <button
                    onClick={() => updateRole({
                      spaceId,
                      memberId: member._id,
                      newRole: member.role === 'admin' ? 'member' : 'admin',
                    })}
                    className="p-1.5 rounded hover:bg-[var(--border)]"
                    title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                  >
                    <Shield className="h-4 w-4 text-[var(--muted)]" />
                  </button>
                  <button
                    onClick={() => removeMember({ spaceId, memberId: member._id })}
                    className="p-1.5 rounded hover:bg-red-500/20"
                    title="Remove member"
                  >
                    <UserMinus className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// Invites Section
// ============================================
function InvitesSection({
  spaceId,
  invites,
}: {
  spaceId: Id<"spaces">
  invites: any[]
}) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const createInvite = useMutation(api.spaces.createInviteCode)
  const revokeInvite = useMutation(api.spaces.revokeInviteCode)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await createInvite({ spaceId })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-[var(--surface)] border border-[var(--border)]'
    )}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Invite Codes</h3>
          <p className="text-xs text-[var(--muted)]">Share these codes to invite others</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
            'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
            'disabled:opacity-50'
          )}
        >
          {isCreating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            'Generate'
          )}
        </button>
      </div>

      {invites.length === 0 ? (
        <p className="text-sm text-[var(--muted)] text-center py-4">
          No active invite codes
        </p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <div
              key={invite._id}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]"
            >
              <code className="flex-1 font-mono text-sm text-[var(--primary)]">
                {invite.code}
              </code>
              <button
                onClick={() => handleCopy(invite.code)}
                className="p-1.5 rounded hover:bg-[var(--surface-hover)]"
              >
                {copiedCode === invite.code ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 text-[var(--muted)]" />
                )}
              </button>
              <button
                onClick={() => revokeInvite({ inviteId: invite._id })}
                className="p-1.5 rounded hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Danger Zone Section
// ============================================
function DangerZoneSection({
  spaceId,
  displayName,
  isPersonal,
  role,
}: {
  spaceId: Id<"spaces">
  displayName: string
  isPersonal: boolean
  role: string
}) {
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const deleteSpace = useMutation(api.spaces.deleteSpace)
  const leaveSpace = useMutation(api.spaces.leaveSpace)

  const handleDelete = async () => {
    if (confirmText !== displayName) return

    setIsDeleting(true)
    try {
      await deleteSpace({ spaceId, confirmationName: confirmText })
      navigate('/groups')
    } catch (error) {
      console.error('Failed to delete:', error)
      setIsDeleting(false)
    }
  }

  const handleLeave = async () => {
    setIsLeaving(true)
    try {
      await leaveSpace({ spaceId })
      navigate('/groups')
    } catch (error) {
      console.error('Failed to leave:', error)
      setIsLeaving(false)
    }
  }

  if (isPersonal) return null

  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-red-500/10 border border-red-500/30'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <h3 className="font-semibold text-red-400">Danger Zone</h3>
      </div>

      {role === 'creator' ? (
        <>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
                'bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium',
                'transition-colors'
              )}
            >
              <Trash2 className="h-4 w-4" />
              Delete Group
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-300">
                Type <strong>{displayName}</strong> to confirm deletion. This will permanently delete all data in this group.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={displayName}
                className={cn(
                  'w-full px-3 py-2 rounded-lg',
                  'bg-[var(--background)] border border-red-500/50',
                  'focus:outline-none focus:border-red-500',
                  'text-sm'
                )}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setConfirmText('')
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={confirmText !== displayName || isDeleting}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg bg-red-500 text-white font-medium',
                    'hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={handleLeave}
          disabled={isLeaving}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
            'bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium',
            'transition-colors disabled:opacity-50'
          )}
        >
          <LogOut className="h-4 w-4" />
          {isLeaving ? 'Leaving...' : 'Leave Group'}
        </button>
      )}
    </div>
  )
}
