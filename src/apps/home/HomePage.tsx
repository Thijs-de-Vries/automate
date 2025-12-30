import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

// Coming soon apps - easy to add more here!
const COMING_SOON_APPS = [
  { name: 'Clothing Tracker', icon: '👕', description: 'Keep track of what you bought' },
]

export default function HomePage() {
  const { user } = useUser() // returns current user info from Clerk
  const taskStats = useQuery(api.tasks.getStats)
  const packingStats = useQuery(api.packing.getStats)
  const transportStats = useQuery(api.publicTransport.getStats)

  const firstName = user?.firstName || 'there'

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="text-center pt-4">
        <h2 className="text-2xl font-bold">
          Hey {firstName}! 👋
        </h2>
        <p className="text-slate-400 mt-1">What would you like to do?</p>
      </div>

      {/* Active Apps */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tasks Card */}
        <Link
          to="/tasks"
          className="group p-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10"
        >
          <div className="text-3xl mb-3">✅</div>
          <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">
            Tasks
          </h3>
          <p className="text-sm text-slate-400 mt-1">Shared to-do list</p>
          {taskStats && (
            <div className="mt-3 text-xs text-slate-500">
              <span className="text-green-400">{taskStats.completed}</span>
              <span className="text-slate-600">/</span>
              <span>{taskStats.total}</span>
              <span className="ml-1">done</span>
            </div>
          )}
        </Link>

        {/* Packing Card */}
        <Link
          to="/packing"
          className="group p-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10"
        >
          <div className="text-3xl mb-3">🧳</div>
          <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">
            Packing
          </h3>
          <p className="text-sm text-slate-400 mt-1">Trip packing lists</p>
          {packingStats && (
            <div className="mt-3 text-xs text-slate-500">
              <span className="text-blue-400">{packingStats.tripCount}</span>
              <span className="ml-1">{packingStats.tripCount === 1 ? 'trip' : 'trips'}</span>
            </div>
          )}
        </Link>

        {/* Public Transport Card */}
        <Link
          to="/transport"
          className="group p-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-2xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10"
        >
          <div className="text-3xl mb-3">🚆</div>
          <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">
            Transport
          </h3>
          <p className="text-sm text-slate-400 mt-1">Train disruptions</p>
          {transportStats && (
            <div className="mt-3 text-xs text-slate-500">
              <span className="text-blue-400">{transportStats.routeCount}</span>
              <span className="ml-1">{transportStats.routeCount === 1 ? 'route' : 'routes'}</span>
              {transportStats.activeDisruptionCount > 0 && (
                <span className="ml-2 text-red-400">
                  ⚠️ {transportStats.activeDisruptionCount} disruptions
                </span>
              )}
            </div>
          )}
        </Link>
      </div>

      {/* Coming Soon */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Coming Soon
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {COMING_SOON_APPS.map((app) => (
            <div
              key={app.name}
              className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl opacity-60"
            >
              <div className="text-2xl mb-2">{app.icon}</div>
              <h4 className="font-medium text-sm text-slate-300">{app.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{app.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
