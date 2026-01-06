import { useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  AUTOMATIONS,
  CATEGORIES,
  getAutomationsByCategory,
  type AutomationCategory,
} from '@/config/automations'
import { AutomationCard } from '@/components/AutomationCard'
import { SearchInput } from '@/components/ui/Input'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [openCategories, setOpenCategories] = useState<Set<AutomationCategory>>(
    new Set(CATEGORIES.map(c => c.id))
  )

  const favorites = useQuery(api.tasks.getFavorites)
  const toggleFavorite = useMutation(api.tasks.toggleFavorite)

  // Filter automations based on search
  const filteredAutomations = useMemo(() => {
    if (!searchQuery.trim()) return null // null means show categorized view
    
    const query = searchQuery.toLowerCase()
    return AUTOMATIONS.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)
    )
  }, [searchQuery])

  const toggleCategory = (categoryId: AutomationCategory) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleToggleFavorite = (automationId: string) => {
    toggleFavorite({ automationId })
  }

  const isFavorite = (automationId: string) =>
    favorites?.includes(automationId) ?? false

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Library</h2>
        <p className="text-[var(--muted)] mt-1">
          Browse all your automations
        </p>
      </div>

      {/* Search */}
      <SearchInput
        placeholder="Search automations..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
      />

      {/* Search Results or Categories */}
      {filteredAutomations ? (
        // Search results
        <div className="space-y-3">
          {filteredAutomations.length > 0 ? (
            <>
              <p className="text-xs text-[var(--muted)] uppercase tracking-wider">
                {filteredAutomations.length} result
                {filteredAutomations.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {filteredAutomations.map((automation) => (
                  <AutomationCard
                    key={automation.id}
                    automation={automation}
                    isFavorite={isFavorite(automation.id)}
                    onToggleFavorite={() => handleToggleFavorite(automation.id)}
                    variant="compact"
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              className={cn(
                'flex flex-col items-center justify-center py-12',
                'text-center'
              )}
            >
              <p className="text-[var(--muted)]">
                No automations found for "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      ) : (
        // Categorized view
        <div className="space-y-2">
          {CATEGORIES.map((category) => {
            const categoryAutomations = getAutomationsByCategory(category.id)
            if (categoryAutomations.length === 0) return null

            const CategoryIcon = category.icon
            const isOpen = openCategories.has(category.id)

            return (
              <Collapsible
                key={category.id}
                open={isOpen}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg',
                        'bg-[var(--primary-muted)]'
                      )}
                    >
                      <CategoryIcon className="h-4 w-4 text-[var(--primary)]" />
                    </div>
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-[var(--muted)] ml-auto mr-2">
                      {categoryAutomations.length}
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 pt-3 pb-2">
                    {categoryAutomations.map((automation) => (
                      <AutomationCard
                        key={automation.id}
                        automation={automation}
                        isFavorite={isFavorite(automation.id)}
                        onToggleFavorite={() =>
                          handleToggleFavorite(automation.id)
                        }
                        variant="compact"
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      )}
    </div>
  )
}
