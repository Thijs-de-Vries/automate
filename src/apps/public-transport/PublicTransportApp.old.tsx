import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

// ============================================
// CONSTANTS
// ============================================

const DAYS = [
  { value: 0, label: 'Sun', short: 'Z' },
  { value: 1, label: 'Mon', short: 'M' },
  { value: 2, label: 'Tue', short: 'D' },
  { value: 3, label: 'Wed', short: 'W' },
  { value: 4, label: 'Thu', short: 'D' },
  { value: 5, label: 'Fri', short: 'V' },
  { value: 6, label: 'Sat', short: 'Z' },
]

const DISRUPTION_ICONS: Record<string, string> = {
  MAINTENANCE: '🛠️',
  DISRUPTION: '🔴',
  CALAMITY: '🚨',
}

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function PublicTransportApp() {
  return (
    <Routes>
      <Route index element={<RoutesList />} />
      <Route path="new" element={<CreateRoute />} />
      <Route path=":routeId" element={<RouteDetail />} />
    </Routes>
  )
}

// ============================================
// ROUTES LIST
// ============================================

function RoutesList() {
  const routes = useQuery(api.publicTransport.listRoutes, 'skip') ?? []
  const stationCount = useQuery(api.publicTransport.getStationCount) ?? 0
  const syncStations = useAction(api.publicTransportActions.syncAllStations)
  const [syncing, setSyncing] = useState(false)

  const handleSyncStations = async () => {
    setSyncing(true)
    try {
      const result = await syncStations({})
      alert(`Synced ${result.synced} stations!`)
    } catch (error) {
      alert(`Error: ${error}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Public Transport</h2>
        <Link
          to="/transport/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          + Add Route
        </Link>
      </div>

      {/* Station cache status */}
      <div className="p-3 bg-slate-800 rounded-lg flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {stationCount > 0 
            ? `${stationCount} stations cached` 
            : 'No stations cached yet'}
        </span>
        <button
          onClick={handleSyncStations}
          disabled={syncing}
          className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync Stations'}
        </button>
      </div>

      {/* Routes list */}
      <ul className="space-y-3">
        {routes.length === 0 ? (
          <li className="text-center py-8 text-slate-500">
            No routes yet. Add one above!
          </li>
        ) : (
          routes.map((route) => (
            <RouteCard key={route._id} route={route} />
          ))
        )}
      </ul>
    </div>
  )
}

// ============================================
// ROUTE CARD
// ============================================

function RouteCard({ route }: { route: any }) {
  const hasChanges = route.status?.changedSinceLastView
  const disruptionCount = route.activeDisruptionCount || 0
  const additionalTravelTime = route.additionalTravelTimeSummary

  return (
    <Link
      to={`/transport/${route._id}`}
      className="block p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Icon with badge */}
        <div className="relative">
          <span className="text-2xl">🚆</span>
          {hasChanges && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          )}
        </div>

        {/* Route info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold group-hover:text-blue-400 transition-colors truncate">
            {route.name}
          </h3>
          <p className="text-sm text-slate-400 truncate">
            {route.originName} → {route.destinationName}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {/* Schedule days */}
            <div className="flex gap-0.5">
              {DAYS.map((day) => (
                <span
                  key={day.value}
                  className={`w-5 h-5 text-xs flex items-center justify-center rounded ${
                    route.scheduleDays.includes(day.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  {day.short}
                </span>
              ))}
            </div>
            <span className="text-xs text-slate-500">@ {route.departureTime}</span>
            {route.urgencyLevel === 'important' && (
              <span className="text-xs px-1.5 py-0.5 bg-orange-600/20 text-orange-400 rounded">
                ⚡ Important
              </span>
            )}
            {additionalTravelTime && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                {additionalTravelTime}
              </span>
            )}
          </div>
        </div>

        {/* Disruption count */}
        {disruptionCount > 0 && (
          <div className="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg text-sm font-medium">
            {disruptionCount} {disruptionCount === 1 ? 'disruption' : 'disruptions'}
          </div>
        )}
      </div>
    </Link>
  )
}

// ============================================
// CREATE ROUTE
// ============================================

// Route option type from fetchRouteOptions
interface RouteOption {
  uid: string
  durationInMinutes: number
  transfers: number
  stations: Array<{ code: string; name: string }>
  viaStations: string
}

function CreateRoute() {
  const navigate = useNavigate()
  const createRoute = useMutation(api.publicTransport.createRoute)
  const fetchRouteOptions = useAction(api.publicTransportActions.fetchRouteOptions)
  const stationCount = useQuery(api.publicTransport.getStationCount) ?? 0

  // Step management: 1 = select stations, 2 = select route, 3 = configure details
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [originCode, setOriginCode] = useState('')
  const [originName, setOriginName] = useState('')
  const [destinationCode, setDestinationCode] = useState('')
  const [destinationName, setDestinationName] = useState('')
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri
  const [departureTime, setDepartureTime] = useState('08:00')
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'important'>('normal')

  // Route selection
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  // Station search
  const [originSearch, setOriginSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const originResults = useQuery(
    api.publicTransport.searchStations,
    originSearch.length >= 2 ? { query: originSearch } : 'skip'
  ) ?? []
  const destResults = useQuery(
    api.publicTransport.searchStations,
    destSearch.length >= 2 ? { query: destSearch } : 'skip'
  ) ?? []

  // Fetch route options when moving to step 2
  const handleFetchRoutes = async () => {
    if (!originCode || !destinationCode) return

    setLoadingRoutes(true)
    setRouteError(null)
    try {
      const options = await fetchRouteOptions({
        originCode,
        destinationCode,
      })
      setRouteOptions(options)
      if (options.length > 0) {
        setSelectedRoute(options[0])
      }
      setStep(2)
    } catch (err) {
      console.error('Failed to fetch routes:', err)
      setRouteError('Failed to fetch route options. You can continue with just origin/destination.')
      // Allow continuing without route options
      setSelectedRoute(null)
      setStep(2)
    } finally {
      setLoadingRoutes(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !originCode || !destinationCode || scheduleDays.length === 0) return

    const id = await createRoute({
      name: name.trim(),
      originCode,
      originName: originName || originCode,
      destinationCode,
      destinationName: destinationName || destinationCode,
      scheduleDays,
      departureTime,
      urgencyLevel,
      // Include stations from selected route if available
      stations: selectedRoute?.stations,
    })
    navigate(`/transport/${id}`)
  }

  const toggleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/transport"
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h2 className="text-2xl font-bold">New Route</h2>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step
                  ? 'bg-green-600 text-white'
                  : s === step
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-600' : 'bg-slate-700'}`} />}
          </div>
        ))}
        <span className="text-sm text-slate-400 ml-2">
          {step === 1 ? 'Select Stations' : step === 2 ? 'Choose Route' : 'Configure Details'}
        </span>
      </div>

      {stationCount === 0 && (
        <div className="p-4 bg-yellow-600/20 border border-yellow-600/50 rounded-lg text-yellow-200 text-sm">
          ⚠️ No stations cached. Go back and sync stations first for autocomplete to work.
          You can still enter station codes manually (e.g., GVC, UTR, ASD).
        </div>
      )}

      {/* Step 1: Select stations */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Origin station */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Origin Station</label>
            <StationPicker
              value={originCode}
              onChange={(code, name) => {
                setOriginCode(code)
                setOriginName(name || code)
                setOriginSearch(name || code)
              }}
              search={originSearch}
              onSearchChange={setOriginSearch}
              results={originResults}
              placeholder="Search or enter code (e.g., GVC)"
            />
          </div>

          {/* Destination station */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Destination Station</label>
            <StationPicker
              value={destinationCode}
              onChange={(code, name) => {
                setDestinationCode(code)
                setDestinationName(name || code)
                setDestSearch(name || code)
              }}
              search={destSearch}
              onSearchChange={setDestSearch}
              results={destResults}
              placeholder="Search or enter code (e.g., UTR)"
            />
          </div>

          <button
            type="button"
            onClick={handleFetchRoutes}
            disabled={!originCode || !destinationCode || loadingRoutes}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loadingRoutes ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Finding Routes...</span>
              </>
            ) : (
              'Find Routes →'
            )}
          </button>
        </div>
      )}

      {/* Step 2: Select route option */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-sm text-slate-400">
            <span className="font-medium text-white">{originName}</span> → <span className="font-medium text-white">{destinationName}</span>
          </div>

          {routeError && (
            <div className="p-3 bg-yellow-600/20 border border-yellow-600/50 rounded-lg text-yellow-200 text-sm">
              {routeError}
            </div>
          )}

          {routeOptions.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">Select a route (via stations will be monitored for disruptions)</label>
              {routeOptions.map((route) => (
                <button
                  key={route.uid}
                  type="button"
                  onClick={() => setSelectedRoute(route)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    selectedRoute?.uid === route.uid
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {route.viaStations ? `via ${route.viaStations}` : 'Direct'}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        {route.durationInMinutes} min • {route.transfers} transfer{route.transfers !== 1 ? 's' : ''} • {route.stations.length} stations
                      </div>
                    </div>
                    {selectedRoute?.uid === route.uid && (
                      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {/* Show all stations in the route */}
                  <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-1">
                    {route.stations.map((s, i) => (
                      <span key={s.code} className="flex items-center">
                        {i > 0 && <span className="mx-1">→</span>}
                        {s.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-800 rounded-lg text-slate-400 text-center">
              No route options found. The route will be created with just origin and destination.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure details */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected route summary */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Selected Route</div>
            <div className="font-medium">{originName} → {destinationName}</div>
            {selectedRoute && (
              <div className="text-sm text-slate-400 mt-1">
                {selectedRoute.viaStations ? `via ${selectedRoute.viaStations}` : 'Direct'} • {selectedRoute.stations.length} stations monitored
              </div>
            )}
          </div>

          {/* Route name */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Route Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Commute to Utrecht"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Schedule days */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Travel Days</label>
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    scheduleDays.includes(day.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Departure time */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Departure Time</label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Urgency level */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Urgency Level</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUrgencyLevel('normal')}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  urgencyLevel === 'normal'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <div className="font-medium">Normal</div>
                <div className="text-xs opacity-75 mt-1">Check every 10 min, 1h before</div>
              </button>
              <button
                type="button"
                onClick={() => setUrgencyLevel('important')}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  urgencyLevel === 'important'
                    ? 'bg-orange-600 border-orange-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <div className="font-medium">⚡ Important</div>
                <div className="text-xs opacity-75 mt-1">Check 2h before, every 5 min near departure</div>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || scheduleDays.length === 0}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
            >
              Create Route ✓
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ============================================
// STATION PICKER COMPONENT
// ============================================

function StationPicker({
  value,
  onChange,
  search,
  onSearchChange,
  results,
  placeholder,
}: {
  value: string
  onChange: (code: string, name?: string) => void
  search: string
  onSearchChange: (search: string) => void
  results: any[]
  placeholder: string
}) {
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value)
          setShowDropdown(true)
          // If user types a valid code directly, set it
          if (e.target.value.match(/^[A-Z]{2,5}$/)) {
            onChange(e.target.value.toUpperCase())
          }
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
      />
      {value && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
          {value}
        </span>
      )}
      
      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((station) => (
            <li key={station.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(station.code, station.nameLong)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium">{station.nameLong}</span>
                <span className="text-slate-500 ml-2 text-sm">({station.code})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================
// ROUTE DETAIL
// ============================================

function RouteDetail() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'active' | 'old'>('active')

  const route = useQuery(
    api.publicTransport.getRoute,
    routeId ? { routeId: routeId as Id<'pt_routes'> } : 'skip'
  )
  const activeDisruptions = useQuery(
    api.publicTransport.getRouteDisruptions,
    routeId ? { routeId: routeId as Id<'pt_routes'>, isActive: true } : 'skip'
  ) ?? []
  const oldDisruptions = useQuery(
    api.publicTransport.getRouteDisruptions,
    routeId ? { routeId: routeId as Id<'pt_routes'>, isActive: false } : 'skip'
  ) ?? []

  const markViewed = useMutation(api.publicTransport.markRouteViewed)
  const deleteRoute = useMutation(api.publicTransport.deleteRoute)
  const checkNow = useAction(api.publicTransportActions.checkRouteNow)
  const [checking, setChecking] = useState(false)

  const travelTimeSummary = useMemo(() => {
    const formatAdditionalTravelTime = (
      min?: number | null,
      max?: number | null
    ) => {
      if (min != null && max != null && min !== max) {
        return `+${min}-${max} min`;
      }
      const single = max ?? min;
      return single != null ? `+${single} min` : null;
    };

    const candidates = activeDisruptions
      .map((d) => ({
        disruption: d,
        max: d.additionalTravelTimeMax ?? d.additionalTravelTimeMin ?? null,
      }))
      .filter(
        (c) =>
          c.disruption.additionalTravelTimeShortLabel ||
          c.disruption.additionalTravelTimeLabel ||
          c.max !== null
      )
      .sort((a, b) => (b.max ?? 0) - (a.max ?? 0));

    const top = candidates[0]?.disruption;
    if (!top) return null;

    return (
      top.additionalTravelTimeShortLabel ||
      top.additionalTravelTimeLabel ||
      formatAdditionalTravelTime(
        top.additionalTravelTimeMin ?? null,
        top.additionalTravelTimeMax ?? null
      )
    );
  }, [activeDisruptions]);

  // Mark as viewed when opening
  useEffect(() => {
    if (routeId) {
      markViewed({ routeId: routeId as Id<'pt_routes'> })
    }
  }, [routeId, markViewed])

  const handleCheckNow = async () => {
    if (!routeId) return
    setChecking(true)
    try {
      await checkNow({ routeId: routeId as Id<'pt_routes'> })
    } catch (error) {
      console.error('Check failed:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleDelete = async () => {
    if (!routeId) return
    if (!confirm('Delete this route?')) return
    await deleteRoute({ routeId: routeId as Id<'pt_routes'> })
    navigate('/transport')
  }

  if (!route) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">Route not found</p>
        <Link to="/transport" className="text-blue-400 hover:underline">
          ← Back to routes
        </Link>
      </div>
    )
  }

  const disruptions = activeTab === 'active' ? activeDisruptions : oldDisruptions

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/transport"
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{route.name}</h2>
          <p className="text-sm text-slate-400">
            {route.originName} → {route.destinationName}
          </p>
        </div>
      </div>

      {/* Route info */}
      <div className="p-4 bg-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5">
            {DAYS.map((day) => (
              <span
                key={day.value}
                className={`w-6 h-6 text-xs flex items-center justify-center rounded ${
                  route.scheduleDays.includes(day.value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                {day.short}
              </span>
            ))}
          </div>
          <span className="text-slate-400">@ {route.departureTime}</span>
          {route.urgencyLevel === 'important' && (
            <span className="text-xs px-1.5 py-0.5 bg-orange-600/20 text-orange-400 rounded">
              ⚡ Important
            </span>
          )}
        </div>

          {travelTimeSummary && (
            <div className="flex items-center gap-2 text-sm text-amber-300">
              <span className="px-2 py-0.5 bg-amber-500/20 rounded">
                {travelTimeSummary}
              </span>
              <span className="text-xs text-slate-400">Added time from active disruptions</span>
            </div>
          )}
        
        {route.status?.lastCheckedAt && route.status.lastCheckedAt > 0 && (
          <p className="text-xs text-slate-500">
            Last checked: {new Date(route.status.lastCheckedAt).toLocaleString('nl-NL')}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded transition-colors"
          >
            {checking ? 'Checking...' : '🔄 Check Now'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
          >
            Delete Route
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Active ({activeDisruptions.length})
        </button>
        <button
          onClick={() => setActiveTab('old')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'old'
              ? 'bg-slate-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Old ({oldDisruptions.length})
        </button>
      </div>

      {/* Disruptions list */}
      <ul className="space-y-3">
        {disruptions.length === 0 ? (
          <li className="text-center py-8 text-slate-500">
            {activeTab === 'active' 
              ? '✅ No active disruptions' 
              : 'No old disruptions'}
          </li>
        ) : (
          disruptions.map((disruption) => (
            <DisruptionCard key={disruption._id} disruption={disruption} />
          ))
        )}
      </ul>
    </div>
  )
}

// ============================================
// DISRUPTION CARD
// ============================================

function DisruptionCard({ disruption }: { disruption: any }) {
  const icon = DISRUPTION_ICONS[disruption.type] || '⚠️'
  const formatAdditionalTravelTime = (
    min?: number | null,
    max?: number | null
  ) => {
    if (min != null && max != null && min !== max) {
      return `+${min}-${max} min`;
    }
    const single = max ?? min;
    return single != null ? `+${single} min` : null;
  }

  const travelTimeText =
    disruption.additionalTravelTimeShortLabel ||
    disruption.additionalTravelTimeLabel ||
    formatAdditionalTravelTime(
      disruption.additionalTravelTimeMin ?? null,
      disruption.additionalTravelTimeMax ?? null
    )

  return (
    <li className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold">{disruption.title}</h4>
          <p className="text-sm text-slate-400 mt-1">{disruption.period}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {travelTimeText && (
              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded">
                {travelTimeText}
              </span>
            )}
            {disruption.causeLabel && (
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-200 rounded">
                Cause: {disruption.causeLabel}
              </span>
            )}
            {disruption.impactValue !== undefined && disruption.impactValue !== null && (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded">
                Impact {disruption.impactValue}/5
              </span>
            )}
            {disruption.alternativeTransportLabel && (
              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-200 rounded">
                Alt: {disruption.alternativeTransportLabel}
              </span>
            )}
          </div>
          {disruption.description && (
            <p className="text-sm text-slate-300 mt-2">{disruption.description}</p>
          )}
          {disruption.advice && (
            <p className="text-sm text-blue-400 mt-2">💡 {disruption.advice}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {disruption.affectedStations.map((code: string) => (
              <span key={code} className="text-xs px-1.5 py-0.5 bg-slate-700 rounded">
                {code}
              </span>
            ))}
          </div>
        </div>
      </div>
    </li>
  )
}
