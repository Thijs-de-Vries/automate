/**
 * SpaceContext - Manages active space selection and space data
 * 
 * Provides:
 * - activeSpace: Currently selected space
 * - spaces: List of user's spaces
 * - setActiveSpace: Function to switch spaces
 * - ensurePersonalSpace: Creates personal space if needed
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// Space type matching what comes from backend
export interface Space {
  _id: Id<"spaces">
  displayName: string
  iconName: string
  isPersonal: boolean
  createdBy: string
  createdAt: number
  role: "creator" | "admin" | "member"
  notificationPreferences: {
    tasks: boolean
    packing: boolean
    transport: boolean
    calisthenics: boolean
  }
}

interface SpaceContextType {
  spaces: Space[]
  activeSpace: Space | null
  activeSpaceId: Id<"spaces"> | null
  isLoading: boolean
  setActiveSpaceId: (spaceId: Id<"spaces">) => void
}

const SpaceContext = createContext<SpaceContextType | null>(null)

const ACTIVE_SPACE_KEY = 'auto-m8-active-space'

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [localActiveSpaceId, setLocalActiveSpaceId] = useState<Id<"spaces"> | null>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_SPACE_KEY)
      return stored as Id<"spaces"> | null
    }
    return null
  })
  const [hasEnsuredSpace, setHasEnsuredSpace] = useState(false)

  // Fetch user's spaces
  const spacesData = useQuery(api.spaces.getUserSpaces)
  const serverActiveSpaceId = useQuery(api.spaces.getActiveSpaceId)
  const setActiveSpace = useMutation(api.spaces.setActiveSpace)
  const ensurePersonalSpace = useMutation(api.spaces.ensurePersonalSpaceExists)

  // Ensure personal space exists on first load
  useEffect(() => {
    if (!hasEnsuredSpace && spacesData !== undefined) {
      ensurePersonalSpace().then(() => setHasEnsuredSpace(true))
    }
  }, [hasEnsuredSpace, spacesData, ensurePersonalSpace])

  // Cast to typed array
  const spaces = (spacesData ?? []) as Space[]

  // Determine the active space
  const activeSpaceId = localActiveSpaceId ?? serverActiveSpaceId ?? null
  const activeSpace = spaces.find(s => s._id === activeSpaceId) ?? null

  // If no active space but we have spaces, default to Personal space
  // Only run this on initial load, not when switching spaces
  useEffect(() => {
    if (spaces.length > 0 && !localActiveSpaceId && !serverActiveSpaceId) {
      const personalSpace = spaces.find(s => s.isPersonal)
      if (personalSpace) {
        setLocalActiveSpaceId(personalSpace._id)
        localStorage.setItem(ACTIVE_SPACE_KEY, personalSpace._id)
        setActiveSpace({ spaceId: personalSpace._id })
      }
    }
  }, [spaces, localActiveSpaceId, serverActiveSpaceId, setActiveSpace])

  // Function to change active space
  const handleSetActiveSpaceId = (spaceId: Id<"spaces">) => {
    setLocalActiveSpaceId(spaceId)
    localStorage.setItem(ACTIVE_SPACE_KEY, spaceId)
    setActiveSpace({ spaceId })
  }

  const isLoading = spacesData === undefined

  return (
    <SpaceContext.Provider
      value={{
        spaces,
        activeSpace,
        activeSpaceId,
        isLoading,
        setActiveSpaceId: handleSetActiveSpaceId,
      }}
    >
      {children}
    </SpaceContext.Provider>
  )
}

export function useSpace() {
  const context = useContext(SpaceContext)
  if (!context) {
    throw new Error('useSpace must be used within a SpaceProvider')
  }
  return context
}

// Hook to get just the active space ID (for passing to queries)
export function useActiveSpaceId() {
  const { activeSpaceId } = useSpace()
  return activeSpaceId
}
