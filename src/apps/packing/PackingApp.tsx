import { useState } from 'react'
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id, Doc } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Luggage, Trash2, Plus, CheckSquare, Shirt, Droplet, Smartphone, FileText, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

// Type aliases for readability
type Trip = Doc<"packing_trips">
type Item = Doc<"packing_items">

const CATEGORIES = ['clothes', 'toiletries', 'electronics', 'documents', 'other'] as const

const CATEGORY_ICONS = {
  clothes: Shirt,
  toiletries: Droplet,
  electronics: Smartphone,
  documents: FileText,
  other: Package,
}

const CATEGORY_COLORS = {
  clothes: '#8B5CF6',
  toiletries: '#22C55E', 
  electronics: '#F59E0B',
  documents: '#EF4444',
  other: '#71717A',
}

export default function PackingApp() {
  return (
    <Routes>
      <Route index element={<TripsList />} />
      <Route path=":tripId" element={<TripDetail />} />
    </Routes>
  )
}

function TripsList() {
  const [newTrip, setNewTrip] = useState('')
  const trips: Trip[] = useQuery(api.packing.listTrips) ?? []
  const createTrip = useMutation(api.packing.createTrip)
  const deleteTrip = useMutation(api.packing.deleteTrip)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTrip.trim()) return
    const id = await createTrip({ name: newTrip.trim() })
    setNewTrip('')
    navigate(`/packing/${id}`)
  }

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold">Packing Lists</h2>

      {/* Create trip form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newTrip}
          onChange={(e) => setNewTrip(e.target.value)}
          placeholder="New trip name..."
          className="flex-1 px-4 py-3 rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <Button type="submit" disabled={!newTrip.trim()}>
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      {/* Trips list */}
      <div className="space-y-2">
        {trips.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'var(--primary-muted)' }}>
                <Luggage className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium">No trips yet</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Create your first packing list above
                </p>
              </div>
            </div>
          </Card>
        ) : (
          trips.map((trip) => (
            <Card
              key={trip._id}
              className="p-4 flex items-center gap-3 group transition-all hover:scale-[1.01]"
            >
              <Link
                to={`/packing/${trip._id}`}
                className="flex-1 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                     style={{ backgroundColor: 'var(--primary-muted)' }}>
                  <Luggage className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <span className="font-medium">{trip.name}</span>
              </Link>
              <button
                onClick={() => deleteTrip({ id: trip._id })}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all hover:bg-[var(--destructive-muted)]"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--destructive)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const [newItem, setNewItem] = useState('')
  const [category, setCategory] = useState<string>('other')
  
  const trips: Trip[] = useQuery(api.packing.listTrips) ?? []
  const items: Item[] = useQuery(
    api.packing.listItems,
    tripId ? { tripId: tripId as Id<'packing_trips'> } : 'skip'
  ) ?? []
  const addItem = useMutation(api.packing.addItem)
  const toggleItem = useMutation(api.packing.toggleItem)
  const removeItem = useMutation(api.packing.removeItem)

  const trip = trips.find((t) => t._id === tripId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim() || !tripId) return
    await addItem({
      tripId: tripId as Id<'packing_trips'>,
      text: newItem.trim(),
      category,
    })
    setNewItem('')
  }

  // Group items by category
  const itemsByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter((item) => item.category === cat)
    return acc
  }, {} as Record<string, Item[]>)

  const packedCount = items.filter((i) => i.isPacked).length

  if (!trip) {
    return (
      <Card className="p-12 text-center">
        <p style={{ color: 'var(--muted-foreground)' }} className="mb-4">Trip not found</p>
        <Link to="/packing">
          <Button variant="outline">← Back to trips</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{trip.name}</h2>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {packedCount} of {items.length} packed
        </p>
      </div>

      {/* Add item form */}
      <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add item..."
          className="flex-1 min-w-[200px] px-4 py-3 rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-3 rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={!newItem.trim()}>
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      {/* Items by category */}
      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const catItems = itemsByCategory[cat]
          if (catItems.length === 0) return null
          const Icon = CATEGORY_ICONS[cat]
          const color = CATEGORY_COLORS[cat]

          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--muted-foreground)' }}>
                  {cat}
                </h3>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  ({catItems.filter((i) => i.isPacked).length}/{catItems.length})
                </span>
              </div>
              <div className="space-y-1">
                {catItems.map((item) => (
                  <Card
                    key={item._id}
                    className="p-3 flex items-center gap-3 group"
                  >
                    <button
                      onClick={() => toggleItem({ id: item._id })}
                      className={cn(
                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                        item.isPacked
                          ? "border-[var(--success)] bg-[var(--success)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]"
                      )}
                    >
                      {item.isPacked && (
                        <CheckSquare className="w-3 h-3 text-white" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "flex-1 text-sm transition-all",
                        item.isPacked && "line-through opacity-50"
                      )}
                    >
                      {item.text}
                    </span>
                    <button
                      onClick={() => removeItem({ id: item._id })}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
                      style={{ color: 'var(--muted-foreground)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--destructive)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <Card className="p-12 text-center">
            <p style={{ color: 'var(--muted-foreground)' }}>
              No items yet. Add some above!
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
