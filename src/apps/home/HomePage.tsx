import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useActiveSpaceId } from '@/contexts/SpaceContext'
import { getAutomationById } from '@/config/automations'
import { AutomationCard } from '@/components/AutomationCard'
import { Star, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'

export default function HomePage() {
  const { user } = useUser()
  const favorites = useQuery(api.tasks.getFavorites)
  const reorderFavorites = useMutation(api.tasks.reorderFavorites)
  const toggleFavorite = useMutation(api.tasks.toggleFavorite)

  const firstName = user?.firstName || 'there'
  
  // Get favorite automations in order
  const favoriteAutomations = (favorites ?? [])
    .map(id => getAutomationById(id))
    .filter(Boolean)

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = favorites?.indexOf(active.id as string) ?? -1
      const newIndex = favorites?.indexOf(over.id as string) ?? -1
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(favorites!, oldIndex, newIndex)
        reorderFavorites({ favoriteIds: newOrder })
      }
    }
  }

  const handleToggleFavorite = (automationId: string) => {
    toggleFavorite({ automationId })
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-8 py-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, {firstName}
        </h2>
        <p className="text-[var(--muted)] mt-1">
          {favoriteAutomations.length > 0 
            ? 'Your pinned automations'
            : 'Pin automations from the Library to get started'}
        </p>
      </div>

      {/* Favorites Grid */}
      {favoriteAutomations.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={favoriteAutomations.map(a => a!.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3">
              {favoriteAutomations.map((automation) => (
                <AutomationCard
                  key={automation!.id}
                  automation={automation!}
                  isFavorite={true}
                  onToggleFavorite={() => handleToggleFavorite(automation!.id)}
                  isDraggable={true}
                  variant="default"
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div
          className={cn(
            'flex flex-col items-center justify-center py-16 px-4',
            'border-2 border-dashed border-[var(--border)] rounded-2xl',
            'bg-[var(--surface)]/50'
          )}
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--primary-muted)] mb-4">
            <Star className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No favorites yet</h3>
          <p className="text-[var(--muted)] text-sm text-center mb-4 max-w-xs">
            Star automations from the Library to pin them here for quick access
          </p>
          <Link
            to="/library"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
              'text-white font-medium text-sm',
              'transition-all duration-200 shadow-lg shadow-[var(--primary-glow)]'
            )}
          >
            Browse Library
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Quick Stats */}
      <QuickStats />
    </div>
  )
}

function QuickStats() {
  const activeSpaceId = useActiveSpaceId()
  
  const taskStats = useQuery(
    api.tasks.getStats,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  )
  const packingStats = useQuery(
    api.packing.getStats,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  )
  const transportStats = useQuery(
    api.publicTransport.getStats,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  )

  const stats = [
    taskStats && {
      label: 'Tasks',
      value: `${taskStats.completed}/${taskStats.total}`,
      subtext: 'completed',
    },
    packingStats && {
      label: 'Trips',
      value: packingStats.tripCount.toString(),
      subtext: 'saved',
    },
    transportStats && {
      label: 'Routes',
      value: transportStats.routeCount.toString(),
      subtext: transportStats.activeDisruptionCount > 0 
        ? `${transportStats.activeDisruptionCount} disruptions`
        : 'monitored',
      alert: transportStats.activeDisruptionCount > 0,
    },
  ].filter(Boolean)

  if (stats.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">
        Overview
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat!.label}
            className={cn(
              'p-3 rounded-xl border',
              'bg-[var(--surface)] border-[var(--border)]'
            )}
          >
            <div className="text-xs text-[var(--muted)] mb-1">{stat!.label}</div>
            <div className="text-lg font-semibold">{stat!.value}</div>
            <div
              className={cn(
                'text-xs',
                stat!.alert ? 'text-amber-400' : 'text-[var(--muted)]'
              )}
            >
              {stat!.subtext}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
