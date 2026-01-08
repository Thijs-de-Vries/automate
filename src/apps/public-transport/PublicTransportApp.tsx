import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Train, Plus, RefreshCw, Trash2, AlertTriangle, Clock, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveSpaceId } from '@/contexts/SpaceContext'

// Route option type from fetchRouteOptions
interface RouteOption {
  uid: string
  durationInMinutes: number
  transfers: number
  stations: Array<{ code: string; name: string }>
  viaStations: string
}

const DAYS = [
  { value: 0, label: 'Sun', short: 'S' },
  { value: 1, label: 'Mon', short: 'M' },
  { value: 2, label: 'Tue', short: 'T' },
  { value: 3, label: 'Wed', short: 'W' },
  { value: 4, label: 'Thu', short: 'T' },
  { value: 5, label: 'Fri', short: 'F' },
  { value: 6, label: 'Sat', short: 'S' },
]

const DISRUPTION_TYPE_COLORS = {
  MAINTENANCE: '#F59E0B',
  DISRUPTION: '#EF4444',
  CALAMITY: '#DC2626',
}

export default function PublicTransportApp() {
  return (
    <Routes>
      <Route index element={<RoutesList />} />
      <Route path="new" element={<CreateRoute />} />
      <Route path=":routeId" element={<RouteDetail />} />
    </Routes>
  )
}

function RoutesList() {
  const activeSpaceId = useActiveSpaceId()
  const routes = useQuery(
    api.publicTransport.listRoutes,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  ) ?? []
  const stationCount = useQuery(api.publicTransport.getStationCount) ?? 0
  const syncStations = useAction(api.publicTransportActions.syncAllStations)
  const [syncing, setSyncing] = useState(false)

  const handleSyncStations = async () => {
    setSyncing(true)
    try {
      const result = await syncStations({})
      alert(`Synced ${result.synced} stations!`)
    } catch (error) {
      alert(`Error syncing stations`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Public Transport</h2>
        <Link to="/transport/new">
          <Button>
            <Plus className="w-5 h-5 mr-2" />
            Add Route
          </Button>
        </Link>
      </div>

      {/* Station cache status */}
      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {stationCount > 0 ? `${stationCount} stations cached` : 'No stations cached'}
        </span>
        <Button
          onClick={handleSyncStations}
          disabled={syncing}
          variant="outline"
          size="sm"
        >
          {syncing ? 'Syncing...' : 'Sync Stations'}
        </Button>
      </Card>

      {/* Routes list */}
      <div className="space-y-3">
        {routes.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'var(--primary-muted)' }}>
                <Train className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium">No routes yet</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Create your first route to start monitoring disruptions
                </p>
              </div>
            </div>
          </Card>
        ) : (
          routes.map((route) => <RouteCard key={route._id} route={route} />)
        )}
      </div>
    </div>
  )
}

function RouteCard({ route }: { route: any }) {
  const hasChanges = route.status?.changedSinceLastView
  const disruptionCount = route.activeDisruptionCount || 0
  const additionalTime = route.additionalTravelTimeSummary

  return (
    <Link to={`/transport/${route._id}`}>
      <Card className="p-4 transition-all hover:scale-[1.01] relative">
        {hasChanges && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
               style={{ backgroundColor: 'var(--destructive)' }} />
        )}
        
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
               style={{ backgroundColor: 'var(--primary-muted)' }}>
            <Train className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{route.name}</h3>
            <p className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
              {route.originName} → {route.destinationName}
            </p>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Days */}
              <div className="flex gap-0.5">
                {DAYS.map((day) => (
                  <span
                    key={day.value}
                    className={cn(
                      "w-5 h-5 text-xs flex items-center justify-center rounded",
                      route.scheduleDays.includes(day.value)
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface-hover)] opacity-30"
                    )}
                    style={{ color: route.scheduleDays.includes(day.value) ? 'white' : 'var(--muted)' }}
                  >
                    {day.short}
                  </span>
                ))}
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                @ {route.departureTime}
              </span>
              {route.urgencyLevel === 'important' && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--warning-muted)', color: 'var(--warning)' }}>
                  ⚡ Important
                </span>
              )}
              {additionalTime && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--warning-muted)', color: 'var(--warning)' }}>
                  {additionalTime}
                </span>
              )}
            </div>
          </div>

          {disruptionCount > 0 && (
            <div className="px-2 py-1 rounded-lg text-sm font-medium shrink-0"
                 style={{ backgroundColor: 'var(--destructive-muted)', color: 'var(--destructive)' }}>
              {disruptionCount}
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}

// Redesigned CreateRoute with auto-fetching and route selection
function CreateRoute() {
  const navigate = useNavigate()
  const activeSpaceId = useActiveSpaceId()
  const createRoute = useMutation(api.publicTransport.createRoute)
  const fetchRouteOptions = useAction(api.publicTransportActions.fetchRouteOptions)
  const checkRouteNow = useAction(api.publicTransportActions.checkRouteNow)
  const stationCount = useQuery(api.publicTransport.getStationCount) ?? 0

  const [name, setName] = useState('')
  const [originCode, setOriginCode] = useState('')
  const [originName, setOriginName] = useState('')
  const [destinationCode, setDestinationCode] = useState('')
  const [destinationName, setDestinationName] = useState('')
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [departureTime, setDepartureTime] = useState('08:00')
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'important'>('normal')

  // Route selection state
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [showAlternatives, setShowAlternatives] = useState(false)

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

  // Validate station codes (must be 2-5 uppercase letters)
  const isValidStationCode = (code: string) => /^[A-Z]{2,5}$/.test(code)

  // Auto-fetch routes when both valid stations are selected
  useEffect(() => {
    const fetchRoutes = async () => {
      // Reset state if codes are missing or invalid
      if (!originCode || !destinationCode || !isValidStationCode(originCode) || !isValidStationCode(destinationCode)) {
        setRouteOptions([])
        setSelectedRoute(null)
        setRouteError(null)
        return
      }

      setLoadingRoutes(true)
      setRouteError(null)
      try {
        const options = await fetchRouteOptions({
          originCode,
          destinationCode,
        })
        
        if (options.length === 0) {
          setRouteError("NS hasn't returned any routes for this journey. If you believe this is incorrect, please contact me (Thijs).")
          setRouteOptions([])
          setSelectedRoute(null)
        } else {
          setRouteOptions(options)
          setSelectedRoute(options[0]) // Auto-select first route
        }
      } catch (err) {
        console.error('Failed to fetch routes:', err)
        setRouteError("Failed to fetch routes from NS API. If this persists, please contact me (Thijs).")
        setRouteOptions([])
        setSelectedRoute(null)
      } finally {
        setLoadingRoutes(false)
      }
    }

    fetchRoutes()
  }, [originCode, destinationCode, fetchRouteOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !originCode || !destinationCode || scheduleDays.length === 0 || !activeSpaceId) return

    const id = await createRoute({
      name: name.trim(),
      originCode,
      originName: originName || originCode,
      destinationCode,
      destinationName: destinationName || destinationCode,
      scheduleDays,
      departureTime,
      urgencyLevel,
      spaceId: activeSpaceId,
      // Pass the selected route's stations array
      stations: selectedRoute?.stations,
    })
    
    // Check for disruptions immediately after creation
    try {
      await checkRouteNow({ routeId: id })
    } catch (error) {
      console.error('Failed to check route after creation:', error)
      // Don't block navigation if check fails
    }
    
    navigate(`/transport/${id}`)
  }

  const toggleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold">New Route</h2>

      {stationCount === 0 && (
        <Card className="p-4" style={{ backgroundColor: 'var(--warning-muted)', borderColor: 'var(--warning)' }}>
          <p className="text-sm" style={{ color: 'var(--warning)' }}>
            ⚠️ No stations cached. Sync stations from the main screen for autocomplete.
          </p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Route name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Route Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Commute to Utrecht"
            className="w-full px-4 py-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Origin */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            From
          </label>
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

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            To
          </label>
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

        {/* Route loading/error/selection */}
        {originCode && destinationCode && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Route
            </label>
            
            {loadingRoutes ? (
              <Card className="p-4 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Finding routes from NS...
                </span>
              </Card>
            ) : routeError ? (
              <Card className="p-4" style={{ backgroundColor: 'var(--destructive-muted)', borderColor: 'var(--destructive)' }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--destructive)' }} />
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                      {routeError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        // Trigger re-fetch by clearing and resetting codes
                        const orig = originCode
                        const dest = destinationCode
                        setOriginCode('')
                        setDestinationCode('')
                        setTimeout(() => {
                          setOriginCode(orig)
                          setDestinationCode(dest)
                        }, 10)
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </Card>
            ) : selectedRoute ? (
              <div className="space-y-3">
                {/* Selected route card */}
                <Card className="p-4" style={{ borderColor: 'var(--primary)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                         style={{ backgroundColor: 'var(--primary-muted)' }}>
                      <Train className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {selectedRoute.viaStations ? `via ${selectedRoute.viaStations}` : 'Direct'}
                      </div>
                      <div className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        {selectedRoute.durationInMinutes} min • {selectedRoute.transfers} transfer{selectedRoute.transfers !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs mt-2 px-2 py-1 rounded inline-block"
                           style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--primary)' }}>
                        {selectedRoute.stations.length} stations monitored for disruptions
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Alternative routes collapsible */}
                {routeOptions.length > 1 && (
                  <Collapsible open={showAlternatives} onOpenChange={setShowAlternatives}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setShowAlternatives(!showAlternatives)}
                    >
                      <span className="flex items-center gap-2">
                        <Train className="w-4 h-4" />
                        {showAlternatives ? 'Hide' : 'Show'} {routeOptions.length - 1} alternative route{routeOptions.length - 1 !== 1 ? 's' : ''}
                      </span>
                      <ChevronDown className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        showAlternatives && "rotate-180"
                      )} />
                    </Button>
                    <CollapsibleContent className="space-y-2 pt-2 px-1 overflow-visible">
                      {routeOptions.slice(1).map((route) => (
                        <Card
                          key={route.uid}
                          className={cn(
                            "p-3 cursor-pointer transition-all hover:scale-[1.005]",
                            selectedRoute.uid === route.uid && "ring-2 ring-[var(--primary)]"
                          )}
                          onClick={() => setSelectedRoute(route)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                 style={{ backgroundColor: 'var(--surface-hover)' }}>
                              <Train className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">
                                {route.viaStations ? `via ${route.viaStations}` : 'Direct'}
                              </div>
                              <div className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                {route.durationInMinutes} min • {route.transfers} transfer{route.transfers !== 1 ? 's' : ''} • {route.stations.length} stations
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Days */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Travel Days
          </label>
          <div className="flex gap-2">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className="w-12 h-12 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: scheduleDays.includes(day.value) ? 'var(--primary)' : 'var(--surface)',
                  color: scheduleDays.includes(day.value) ? 'white' : 'var(--muted-foreground)',
                  border: `1px solid ${scheduleDays.includes(day.value) ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Departure Time
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="px-4 py-3 rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Urgency Level
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={cn(
                "p-4 cursor-pointer transition-all",
                urgencyLevel === 'normal' && "ring-2 ring-[var(--primary)]"
              )}
              onClick={() => setUrgencyLevel('normal')}
            >
              <div className="font-medium">Normal</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Check every 10 min
              </div>
            </Card>
            <Card
              className={cn(
                "p-4 cursor-pointer transition-all",
                urgencyLevel === 'important' && "ring-2 ring-[var(--warning)]"
              )}
              onClick={() => setUrgencyLevel('important')}
            >
              <div className="font-medium">⚡ Important</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Check every 5 min
              </div>
            </Card>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!name.trim() || !originCode || !destinationCode || scheduleDays.length === 0}
          className="w-full"
        >
          Create Route
        </Button>
      </form>
    </div>
  )
}

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
          if (e.target.value.match(/^[A-Z]{2,5}$/)) {
            onChange(e.target.value.toUpperCase())
          }
        }}

        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border transition-colors"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--primary)'
          setShowDropdown(true)
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border)'
          setTimeout(() => setShowDropdown(false), 200)
        }}
      />
      {value && (
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--muted)' }}
        >
          {value}
        </span>
      )}
      
      {showDropdown && results.length > 0 && (
        <div
          className="absolute z-10 w-full mt-1 rounded-xl shadow-lg max-h-60 overflow-auto"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {results.map((station) => (
            <button
              key={station.code}
              type="button"
              onClick={() => {
                onChange(station.code, station.nameLong)
                setShowDropdown(false)
              }}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span className="font-medium">{station.nameLong}</span>
              <span className="ml-2 text-sm" style={{ color: 'var(--muted)' }}>
                ({station.code})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
      <Card className="p-12 text-center">
        <p style={{ color: 'var(--muted-foreground)' }} className="mb-4">Route not found</p>
        <Link to="/transport">
          <Button variant="outline">← Back to routes</Button>
        </Link>
      </Card>
    )
  }

  const travelTimeSummary = (route as any).additionalTravelTimeSummary || null
  const disruptions = activeTab === 'active' ? activeDisruptions : oldDisruptions

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{route.name}</h2>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {route.originName} → {route.destinationName}
        </p>
      </div>

      {/* Route info card */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5">
            {DAYS.map((day) => (
              <span
                key={day.value}
                className={cn(
                  "w-6 h-6 text-xs flex items-center justify-center rounded",
                  route.scheduleDays.includes(day.value)
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-hover)] opacity-30"
                )}
              >
                {day.short}
              </span>
            ))}
          </div>
          <span style={{ color: 'var(--muted-foreground)' }}>@ {route.departureTime}</span>
          {route.urgencyLevel === 'important' && (
            <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--warning-muted)', color: 'var(--warning)' }}>
              ⚡ Important
            </span>
          )}
        </div>

        {travelTimeSummary && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--warning)' }}>
              {travelTimeSummary} additional travel time
            </span>
          </div>
        )}

        {route.status?.lastCheckedAt && route.status.lastCheckedAt > 0 && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Last checked: {new Date(route.status.lastCheckedAt).toLocaleString('nl-NL')}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleCheckNow}
            disabled={checking}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", checking && "animate-spin")} />
            {checking ? 'Checking...' : 'Check Now'}
          </Button>
          <Button
            onClick={handleDelete}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--surface)' }}>
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg transition-colors font-medium",
            activeTab === 'active'
              ? "bg-[var(--primary)] text-white"
              : "hover:bg-[var(--surface-hover)]"
          )}
          style={activeTab !== 'active' ? { color: 'var(--muted-foreground)' } : undefined}
        >
          Active ({activeDisruptions.length})
        </button>
        <button
          onClick={() => setActiveTab('old')}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg transition-colors font-medium",
            activeTab === 'old'
              ? "bg-[var(--surface-active)]"
              : "hover:bg-[var(--surface-hover)]"
          )}
          style={activeTab !== 'old' ? { color: 'var(--muted-foreground)' } : undefined}
        >
          History ({oldDisruptions.length})
        </button>
      </div>

      {/* Disruptions list */}
      <div className="space-y-3">
        {disruptions.length === 0 ? (
          <Card className="p-12 text-center">
            <p style={{ color: 'var(--muted-foreground)' }}>
              {activeTab === 'active' ? '✅ No active disruptions' : 'No past disruptions'}
            </p>
          </Card>
        ) : (
          disruptions.map((disruption) => (
            <DisruptionCard key={disruption._id} disruption={disruption} />
          ))
        )}
      </div>
    </div>
  )
}

function DisruptionCard({ disruption }: { disruption: any }) {
  const typeColor = DISRUPTION_TYPE_COLORS[disruption.type as keyof typeof DISRUPTION_TYPE_COLORS] || '#EF4444'

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${typeColor}20` }}
        >
          <AlertTriangle className="w-5 h-5" style={{ color: typeColor }} />
        </div>
        
        <div className="flex-1 min-w-0 space-y-2">
          <h4 className="font-semibold">{disruption.title}</h4>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {disruption.period}
          </p>
          
          <div className="flex flex-wrap gap-2">
            {disruption.additionalTravelTimeShortLabel && (
              <span className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--warning-muted)', color: 'var(--warning)' }}>
                {disruption.additionalTravelTimeShortLabel}
              </span>
            )}
            {disruption.causeLabel && (
              <span className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--muted-foreground)' }}>
                {disruption.causeLabel}
              </span>
            )}
            {disruption.impactValue !== undefined && disruption.impactValue !== null && (
              <span className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--destructive-muted)', color: 'var(--destructive)' }}>
                Impact {disruption.impactValue}/5
              </span>
            )}
          </div>

          {disruption.description && (
            <p className="text-sm">{disruption.description}</p>
          )}
          
          {disruption.advice && (
            <p className="text-sm" style={{ color: 'var(--primary)' }}>
              💡 {disruption.advice}
            </p>
          )}

          {disruption.affectedStations && disruption.affectedStations.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {disruption.affectedStations.map((code: string) => (
                <span
                  key={code}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--muted)' }}
                >
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
