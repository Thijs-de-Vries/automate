import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { SignInButton, UserButton } from '@clerk/clerk-react'
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import { Suspense, lazy } from 'react'
import { OfflineBanner } from './components/OfflineBanner'

// Lazy load mini-apps
const TasksApp = lazy(() => import('./apps/tasks/TasksApp'))
const PackingApp = lazy(() => import('./apps/packing/PackingApp'))

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-400">Automate</h1>
          <div className="flex items-center gap-3">
            <Authenticated>
              <UserButton afterSignOutUrl="/" />
            </Authenticated>
            <Unauthenticated>
              <SignInButton mode="modal">
                <button className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </Unauthenticated>
            <AuthLoading>
              <div className="text-sm text-slate-400">...</div>
            </AuthLoading>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4">
        <AuthLoading>
          <div className="text-center py-16">
            <div className="text-slate-400">Loading...</div>
          </div>
        </AuthLoading>
        <Authenticated>
          <Suspense fallback={<div className="text-center py-8">Loading app...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/tasks" replace />} />
              <Route path="/tasks" element={<TasksApp />} />
              <Route path="/packing/*" element={<PackingApp />} />
            </Routes>
          </Suspense>
        </Authenticated>
        <Unauthenticated>
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold mb-4">Welcome to Automate</h2>
            <p className="text-slate-400 mb-6">Sign in to access your mini apps</p>
            <SignInButton mode="modal">
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors">
                Get Started
              </button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>

      {/* Bottom navigation */}
      <Authenticated>
        <nav className="bg-slate-800 border-t border-slate-700 px-4 py-2 sticky bottom-0">
          <div className="max-w-4xl mx-auto flex justify-around">
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                  isActive ? 'text-blue-400 bg-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-xs mt-1">Tasks</span>
            </NavLink>
            <NavLink
              to="/packing"
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                  isActive ? 'text-blue-400 bg-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="text-xs mt-1">Packing</span>
            </NavLink>
          </div>
        </nav>
      </Authenticated>
    </div>
  )
}

export default App
