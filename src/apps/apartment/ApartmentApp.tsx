import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useActiveSpaceId } from '@/contexts/SpaceContext'
import { useUser } from '@clerk/clerk-react'
import type { Id, Doc } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { 
  Home, 
  Plus, 
  X, 
  Check, 
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Trash2,
  Edit2,
  SlidersHorizontal
} from 'lucide-react'

type ApartmentItem = Doc<"apartment_items">

type Status = "all" | "active" | "purchased"

const CATEGORIES = [
  "Kitchen",
  "Living room",
  "Desk",
  "Bedroom",
  "Hallway",
  "Closets",
  "Toilet",
  "Bathroom",
  "Storage",
  "Other",
] as const

const URGENCY_COLORS = {
  low: { bg: 'var(--muted)', text: 'var(--muted-foreground)' },
  medium: { bg: '#fbbf24', text: '#000' },
  high: { bg: '#ef4444', text: '#fff' },
}

export default function ApartmentApp() {
  const activeSpaceId = useActiveSpaceId()
  const [statusFilter, setStatusFilter] = useState<Status>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ApartmentItem | null>(null)

  const items = useQuery(
    api.apartment.list,
    activeSpaceId ? { spaceId: activeSpaceId, status: statusFilter } : 'skip'
  ) ?? []

  const stats = useQuery(
    api.apartment.getStats,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  )

  const spaceDetails = useQuery(
    api.spaces.getSpaceDetails,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  )
  const isAdmin = spaceDetails?.role === 'creator' || spaceDetails?.role === 'admin'

  if (!activeSpaceId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary-muted)' }}
              >
                <Home className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium">Select a space</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Choose a space to track apartment items
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">Shopping List</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-1">
                <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Collaborative family wishlist
                </p>
                {(statusFilter !== 'all' || categoryFilter !== 'all') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--primary)' }}>
                      {statusFilter !== 'all' && statusFilter}
                      {statusFilter !== 'all' && categoryFilter !== 'all' && ' • '}
                      {categoryFilter !== 'all' && categoryFilter}
                    </span>
                    <button
                      onClick={() => {
                        setStatusFilter('all')
                        setCategoryFilter('all')
                      }}
                      className="text-xs underline"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button onClick={() => setShowFilterMenu(true)} variant="outline" className="gap-1 sm:gap-2" size="sm">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
              <Button onClick={() => setShowAddModal(true)} className="gap-1 sm:gap-2" size="sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Suggest Item</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {items.filter(item => categoryFilter === 'all' || item.category === categoryFilter).length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary-muted)' }}
                >
                  <Home className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="font-medium">No items yet</p>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {statusFilter === 'all' && categoryFilter === 'all' 
                      ? 'Suggest your first item to get started' 
                      : `No ${statusFilter !== 'all' ? statusFilter + ' ' : ''}items${categoryFilter !== 'all' ? ' in ' + categoryFilter : ''}`}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            items
              .filter(item => categoryFilter === 'all' || item.category === categoryFilter)
              .map((item: ApartmentItem) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  onSelect={setSelectedItem}
                />
              ))
          )}
        </div>
      </div>

      {/* Filter Menu */}
      {showFilterMenu && (
        <FilterMenu
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          onStatusChange={setStatusFilter}
          onCategoryChange={setCategoryFilter}
          onClose={() => setShowFilterMenu(false)}
          stats={stats}
        />
      )}

      {/* Add Item Modal */}
      {showAddModal && activeSpaceId && (
        <AddItemModal
          spaceId={activeSpaceId}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Item Modal */}
      {showEditModal && selectedItem && (
        <EditItemModal
          item={selectedItem}
          onClose={() => {
            setShowEditModal(false)
            setSelectedItem(null)
          }}
        />
      )}

      {/* Item Detail Modal */}
      {selectedItem && !showEditModal && (
        <ItemDetailModal
          item={selectedItem}
          isAdmin={isAdmin}
          onClose={() => setSelectedItem(null)}
          onEdit={() => setShowEditModal(true)}
        />
      )}


    </div>
  )
}

// ============================================
// Item Card Component
// ============================================
function ItemCard({
  item,
  onSelect,
}: {
  item: ApartmentItem
  onSelect: (item: ApartmentItem) => void
}) {
  const markAsPurchased = useMutation(api.apartment.markAsPurchased)
  const markAsActive = useMutation(api.apartment.markAsActive)
  const [showPriceInput, setShowPriceInput] = useState(false)
  const [price, setPrice] = useState(item.estimatedPrice?.toString() || '')

  return (
    <Card
      className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(item)}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Image */}
        {item.imageUrl && (
          <div className="flex-shrink-0">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg truncate">{item.name}</h3>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: URGENCY_COLORS[item.urgency].bg,
                    color: URGENCY_COLORS[item.urgency].text,
                  }}
                >
                  {item.urgency}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--muted)' }}>
                  {item.category}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full capitalize"
                  style={{
                    backgroundColor: item.status === 'purchased' ? '#10b981' : 'var(--muted)',
                    color: item.status === 'purchased' ? '#fff' : 'inherit',
                  }}
                >
                  {item.status}
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="flex-shrink-0">
              {item.estimatedPrice && (
                <div className="text-right">
                  <div className="font-semibold text-sm sm:text-base">€{item.estimatedPrice.toFixed(2)}</div>
                  {item.price && (
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Paid: €{item.price.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {item.description && (
            <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--muted-foreground)' }}>
              {item.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>Added by {item.submittedByName || 'Unknown'}</span>
            {item.purchasedByName && <span>• Purchased by {item.purchasedByName}</span>}
          </div>

          {/* Action Buttons */}
          {item.status === 'active' && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {!showPriceInput ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowPriceInput(true)}
                  className="gap-1 w-full sm:w-auto"
                >
                  <Check className="w-4 h-4" />
                  Mark as Purchased
                </Button>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium block mb-1">
                      How much did you pay? (optional)
                    </label>
                    {item.estimatedPrice && (
                      <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                        Estimated: €{item.estimatedPrice.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        €
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                        autoFocus
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        markAsPurchased({ 
                          id: item._id, 
                          price: price ? parseFloat(price) : undefined 
                        })
                        setShowPriceInput(false)
                      }}
                      title="Confirm purchase"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowPriceInput(false)
                        setPrice(item.estimatedPrice?.toString() || '')
                      }}
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {item.status === 'purchased' && (
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAsActive({ id: item._id })}
                className="flex-1 sm:flex-none"
              >
                Move Back to List
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ============================================
// Add Item Modal
// ============================================
function AddItemModal({ spaceId, onClose }: { spaceId: Id<"spaces">; onClose: () => void }) {
  const submit = useMutation(api.apartment.submit)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [purchaseUrl, setPurchaseUrl] = useState('')
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Other')
  const [estimatedPrice, setEstimatedPrice] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await submit({
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        purchaseUrl: purchaseUrl.trim() || undefined,
        category,
        estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : undefined,
        urgency,
        spaceId,
      })
      onClose()
    } catch (error) {
      console.error('Failed to submit item:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold">Suggest an Item</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Name (Required) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Coffee maker, Desk lamp..."
                required
              />
            </div>

            {/* Category (Required) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Category / Room <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full px-3 py-2 rounded-lg border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about the item..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border resize-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                type="url"
              />
            </div>

            {/* Purchase URL */}
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Link</label>
              <Input
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://store.com/product"
                type="url"
              />
            </div>

            {/* Price and Urgency Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Estimated Price (€)</label>
                <Input
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as typeof urgency)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end" style={{ borderColor: 'var(--border)' }}>
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? 'Submitting...' : 'Submit Item'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ============================================
// Item Detail Modal with Comments
// ============================================
function ItemDetailModal({
  item: initialItem,
  isAdmin,
  onClose,
  onEdit,
}: {
  item: ApartmentItem
  isAdmin: boolean
  onClose: () => void
  onEdit: () => void
}) {
  // Query the latest item data to keep it in sync
  const item = useQuery(api.apartment.getById, { id: initialItem._id }) ?? initialItem
  const comments = useQuery(api.apartment.getComments, { itemId: item._id }) ?? []
  const addComment = useMutation(api.apartment.addComment)
  const deleteItem = useMutation(api.apartment.deleteItem)
  const markAsPurchased = useMutation(api.apartment.markAsPurchased)
  const markAsActive = useMutation(api.apartment.markAsActive)
  const toggleReaction = useMutation(api.apartment.toggleReaction)
  const { user } = useUser()
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null)

  const REACTIONS = [
    { emoji: "👍", key: "thumbsUp" },
    { emoji: "❤️", key: "heart" },
    { emoji: "😂", key: "laugh" },
    { emoji: "😮", key: "wow" },
    { emoji: "😢", key: "sad" },
    { emoji: "🙏", key: "pray" },
  ] as const

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setIsSubmitting(true)
    try {
      await addComment({ itemId: item._id, text: commentText.trim() })
      setCommentText('')
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return
    try {
      await deleteItem({ id: item._id })
      onClose()
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 break-words">{item.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: URGENCY_COLORS[item.urgency].bg,
                    color: URGENCY_COLORS[item.urgency].text,
                  }}
                >
                  {item.urgency}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--muted)' }}>
                  {item.category}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full capitalize"
                  style={{
                    backgroundColor: item.status === 'purchased' ? '#10b981' : 'var(--muted)',
                    color: item.status === 'purchased' ? '#fff' : 'inherit',
                  }}
                >
                  {item.status}
                </span>
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 sm:p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                title="Edit item"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {isAdmin && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 sm:p-2 hover:bg-red-100 rounded-lg text-red-600"
                  title="Delete item"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Image */}
          {item.imageUrl && (
            <div>
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p style={{ color: 'var(--muted-foreground)' }}>{item.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.estimatedPrice && (
              <div>
                <h4 className="text-sm font-medium mb-1">Estimated Price</h4>
                <p style={{ color: 'var(--muted-foreground)' }}>€{item.estimatedPrice.toFixed(2)}</p>
              </div>
            )}
            {item.price && (
              <div>
                <h4 className="text-sm font-medium mb-1">Paid Price</h4>
                <p style={{ color: 'var(--muted-foreground)' }}>€{item.price.toFixed(2)}</p>
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium mb-1">Added by</h4>
              <p style={{ color: 'var(--muted-foreground)' }}>{item.submittedByName || 'Unknown'}</p>
            </div>
            {item.purchasedByName && (
              <div>
                <h4 className="text-sm font-medium mb-1">Purchased by</h4>
                <p style={{ color: 'var(--muted-foreground)' }}>{item.purchasedByName}</p>
              </div>
            )}
          </div>

          {/* Purchase Link */}
          {item.purchaseUrl && (
            <div>
              <a
                href={item.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                View Purchase Link
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Comments Section */}
          <div className="border-t pt-4 sm:pt-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              Comments ({comments.length})
            </h3>

            {/* Comment List */}
            <div className="space-y-3 sm:space-y-4 mb-4">
              {comments.map((comment: any, index: number) => (
                <div key={comment._id}>
                  <div className="p-3 sm:p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-medium text-xs sm:text-sm">{comment.userName || 'Unknown'}</span>
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {new Date(comment.createdAt).toLocaleDateString('nl-NL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm break-words">{comment.text}</p>
                      </div>
                      
                      {/* Reactions on the right */}
                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end" style={{ maxWidth: '40%' }}>
                        {/* Show only reactions that have been used */}
                        {REACTIONS.map(({ emoji, key }) => {
                          const reactors = comment.reactions?.[key] || []
                          const count = reactors.length
                          const hasReacted = user?.id ? reactors.includes(user.id) : false
                          
                          if (count === 0) return null
                          
                          return (
                            <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleReaction({ commentId: comment._id, emoji: key })
                              }}
                              className="px-1 sm:px-1.5 py-0.5 rounded text-xs transition-all hover:scale-110"
                              style={{
                                backgroundColor: hasReacted ? 'var(--primary-muted)' : 'var(--muted)',
                                opacity: hasReacted ? 1 : 0.7,
                              }}
                              title={`${count} reaction${count > 1 ? 's' : ''}`}
                            >
                              <span className="text-sm">{emoji}</span>
                              <span className="ml-0.5">{count}</span>
                            </button>
                          )
                        })}
                        
                        {/* Add reaction button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowReactionsFor(showReactionsFor === comment._id ? null : comment._id)
                            }}
                            className="px-1.5 py-0.5 rounded text-xs hover:bg-gray-200 transition-colors"
                            style={{ color: 'var(--muted-foreground)' }}
                            title="Add reaction"
                          >
                            +
                          </button>
                          
                          {/* Reaction picker popup */}
                          {showReactionsFor === comment._id && (
                            <div 
                              className="absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10 flex gap-1"
                              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                            >
                              {REACTIONS.map(({ emoji, key }) => (
                                <button
                                  key={key}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleReaction({ commentId: comment._id, emoji: key })
                                    setShowReactionsFor(null)
                                  }}
                                  className="px-2 py-1 rounded hover:bg-gray-100 transition-colors text-base sm:text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < comments.length - 1 && (
                    <div className="flex items-center gap-3 my-2 sm:my-3">
                      <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--primary), transparent)' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1"
              />
              <Button type="submit" disabled={!commentText.trim() || isSubmitting}>
                Post
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================================
// Edit Item Modal
// ============================================
function EditItemModal({ item, onClose }: { item: ApartmentItem; onClose: () => void }) {
  const updateItem = useMutation(api.apartment.updateItem)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description || '')
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '')
  const [purchaseUrl, setPurchaseUrl] = useState(item.purchaseUrl || '')
  const [category, setCategory] = useState(item.category)
  const [estimatedPrice, setEstimatedPrice] = useState(item.estimatedPrice?.toString() || '')
  const [urgency, setUrgency] = useState(item.urgency)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await updateItem({
        id: item._id,
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        purchaseUrl: purchaseUrl.trim() || undefined,
        category,
        estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : undefined,
        urgency,
      })
      onClose()
    } catch (error) {
      console.error('Failed to update item:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold">Edit Item</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {/* Name (Required) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Coffee maker, Desk lamp..."
                required
              />
            </div>

            {/* Category (Required) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Category / Room <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full px-3 py-2 rounded-lg border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about the item..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border resize-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                type="url"
              />
            </div>

            {/* Purchase URL */}
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Link</label>
              <Input
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://store.com/product"
                type="url"
              />
            </div>

            {/* Price and Urgency Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Estimated Price (€)</label>
                <Input
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as typeof urgency)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end" style={{ borderColor: 'var(--border)' }}>
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ============================================
// Filter Menu
// ============================================
function FilterMenu({
  statusFilter,
  categoryFilter,
  onStatusChange,
  onCategoryChange,
  onClose,
  stats,
}: {
  statusFilter: Status
  categoryFilter: string
  onStatusChange: (status: Status) => void
  onCategoryChange: (category: string) => void
  onClose: () => void
  stats?: any
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      
      {/* Filter Panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 w-full sm:w-80 z-50 shadow-2xl overflow-y-auto"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b p-4" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Filters</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {(statusFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                onStatusChange('all')
                onCategoryChange('all')
              }}
              className="text-sm mt-2 underline"
              style={{ color: 'var(--primary)' }}
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Filter Sections */}
        <div className="p-4 space-y-6">
          {/* Status Section */}
          <div>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Status
            </h3>
            <div className="space-y-2">
              <FilterOption
                label="All"
                count={stats?.total}
                selected={statusFilter === 'all'}
                onClick={() => onStatusChange('all')}
              />
              <FilterOption
                label="Active"
                count={stats?.active}
                selected={statusFilter === 'active'}
                onClick={() => onStatusChange('active')}
              />
              <FilterOption
                label="Purchased"
                count={stats?.purchased}
                selected={statusFilter === 'purchased'}
                onClick={() => onStatusChange('purchased')}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

          {/* Category Section */}
          <div>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Room
            </h3>
            <div className="space-y-2">
              <FilterOption
                label="All Rooms"
                selected={categoryFilter === 'all'}
                onClick={() => onCategoryChange('all')}
              />
              {CATEGORIES.map((category) => (
                <FilterOption
                  key={category}
                  label={category}
                  selected={categoryFilter === category}
                  onClick={() => onCategoryChange(category)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t p-4" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <Button onClick={onClose} className="w-full">
            Show Results
          </Button>
        </div>
      </div>
    </>
  )
}

// ============================================
// Filter Option Component
// ============================================
function FilterOption({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count?: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
      style={{
        backgroundColor: selected ? 'var(--primary-muted)' : 'transparent',
      }}
    >
      <span className={selected ? 'font-medium' : ''} style={{ color: selected ? 'var(--primary)' : 'inherit' }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: selected ? 'var(--primary)' : 'var(--muted)',
            color: selected ? 'white' : 'var(--muted-foreground)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
