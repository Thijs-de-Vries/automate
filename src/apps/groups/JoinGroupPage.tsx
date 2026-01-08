/**
 * JoinGroupPage - Join a group using an invite code
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { cn } from '@/lib/utils'
import { ArrowLeft, Users, Check, AlertCircle, Home } from 'lucide-react'

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const joinWithCode = useMutation(api.spaces.joinWithCode)

  const [inputCode, setInputCode] = useState(code === 'enter' ? '' : code || '')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ spaceId: string; spaceName: string } | null>(null)

  // Auto-join if code is provided in URL
  useEffect(() => {
    if (code && code !== 'enter' && code.startsWith('join-m8te-')) {
      handleJoin(code)
    }
  }, [code])

  const handleJoin = async (codeToUse: string) => {
    if (!codeToUse.trim()) {
      setError('Please enter an invite code')
      return
    }

    setIsJoining(true)
    setError('')

    try {
      const result = await joinWithCode({ code: codeToUse.trim() })
      setSuccess({ spaceId: result.spaceId, spaceName: result.spaceName || 'Group' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group')
      setIsJoining(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-6 py-6">
        <div className={cn(
          'flex flex-col items-center justify-center py-16',
          'bg-[var(--surface)] border border-[var(--border)] rounded-2xl'
        )}>
          <div className={cn(
            'flex items-center justify-center w-16 h-16 rounded-full',
            'bg-green-500/20 mb-4'
          )}>
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">You're in!</h2>
          <p className="text-[var(--muted)] text-center mb-6">
            You've joined <strong>{success.spaceName}</strong>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className={cn(
                'px-6 py-2 rounded-lg font-medium',
                'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
                'shadow-lg shadow-[var(--primary-glow)]'
              )}
            >
              Go Home
            </button>
            <button
              onClick={() => navigate(`/groups/${success.spaceId}`)}
              className={cn(
                'px-6 py-2 rounded-lg font-medium',
                'bg-[var(--surface-hover)] hover:bg-[var(--border)]'
              )}
            >
              View Group
            </button>
          </div>
        </div>
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
          <h2 className="text-2xl font-bold tracking-tight">Join Group</h2>
          <p className="text-[var(--muted)] text-sm">
            Enter an invite code to join a group
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

      {/* Join form */}
      <div className={cn(
        'p-6 rounded-xl',
        'bg-[var(--surface)] border border-[var(--border)]'
      )}>
        <div className="flex items-center justify-center mb-6">
          <div className={cn(
            'flex items-center justify-center w-16 h-16 rounded-full',
            'bg-[var(--primary-muted)]'
          )}>
            <Users className="h-8 w-8 text-[var(--primary)]" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Invite Code
            </label>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="join-m8te-XXXXX"
              className={cn(
                'w-full px-4 py-3 rounded-xl text-center',
                'bg-[var(--background)] border border-[var(--border)]',
                'focus:outline-none focus:border-[var(--primary)]',
                'font-mono text-lg tracking-wider',
                'placeholder:text-[var(--muted)] placeholder:font-normal'
              )}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={() => handleJoin(inputCode)}
            disabled={isJoining || !inputCode.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
              'text-white font-medium',
              'transition-all duration-200 shadow-lg shadow-[var(--primary-glow)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isJoining ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Users className="h-5 w-5" />
                <span>Join Group</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Help text */}
      <p className="text-center text-sm text-[var(--muted)]">
        Ask a group member for an invite code to join their group
      </p>
    </div>
  )
}
