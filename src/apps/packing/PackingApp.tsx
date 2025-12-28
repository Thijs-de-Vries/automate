import { useState } from 'react'
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id, Doc } from '../../../convex/_generated/dataModel'

// Type aliases for readability
type Trip = Doc<"packing_trips">
type Item = Doc<"packing_items">

const CATEGORIES = ['clothes', 'toiletries', 'electronics', 'documents', 'other'] as const

const CATEGORY_ICONS: Record<string, string> = {
  clothes: '👕',
  toiletries: '🧴',
  electronics: '📱',
  documents: '📄',
  other: '📦',
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Packing Lists</h2>

      {/* Create trip form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newTrip}
          onChange={(e) => setNewTrip(e.target.value)}
          placeholder="New trip name..."
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!newTrip.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
        >
          Create
        </button>
      </form>

      {/* Trips list */}
      <ul className="space-y-2">
        {trips.length === 0 ? (
          <li className="text-center py-8 text-slate-500">
            No trips yet. Create one above!
          </li>
        ) : (
          trips.map((trip) => (
            <li
              key={trip._id}
              className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg group"
            >
              <Link
                to={`/packing/${trip._id}`}
                className="flex-1 flex items-center gap-3 hover:text-blue-400 transition-colors"
              >
                <span className="text-2xl">🧳</span>
                <span className="font-medium">{trip.name}</span>
              </Link>
              <button
                onClick={() => deleteTrip({ id: trip._id })}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))
        )}
      </ul>
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
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">Trip not found</p>
        <Link to="/packing" className="text-blue-400 hover:underline">
          ← Back to trips
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/packing"
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{trip.name}</h2>
          <p className="text-sm text-slate-400">
            {packedCount}/{items.length} packed
          </p>
        </div>
      </div>

      {/* Add item form */}
      <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add item..."
          className="flex-1 min-w-[200px] px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_ICONS[cat]} {cat}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!newItem.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </form>

      {/* Items by category */}
      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const catItems = itemsByCategory[cat]
          if (catItems.length === 0) return null

          return (
            <div key={cat} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <span>{CATEGORY_ICONS[cat]}</span>
                <span>{cat}</span>
                <span className="text-xs font-normal">
                  ({catItems.filter((i) => i.isPacked).length}/{catItems.length})
                </span>
              </h3>
              <ul className="space-y-1">
                {catItems.map((item) => (
                  <li
                    key={item._id}
                    className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg group"
                  >
                    <button
                      onClick={() => toggleItem({ id: item._id })}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        item.isPacked
                          ? 'bg-green-600 border-green-600'
                          : 'border-slate-500 hover:border-blue-500'
                      }`}
                    >
                      {item.isPacked && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <span
                      className={`flex-1 ${
                        item.isPacked ? 'line-through text-slate-500' : ''
                      }`}
                    >
                      {item.text}
                    </span>
                    <button
                      onClick={() => removeItem({ id: item._id })}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {items.length === 0 && (
          <p className="text-center py-8 text-slate-500">
            No items yet. Add some above!
          </p>
        )}
      </div>
    </div>
  )
}
