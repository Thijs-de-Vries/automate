import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { SignInButton } from '@clerk/clerk-react'
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import { Suspense, lazy } from 'react'
import { Home, Grid3X3, Sparkles, ChevronLeft } from 'lucide-react'
import { OfflineBanner } from './components/OfflineBanner'
import { UserButtonWithNotifications } from './components/UserButtonWithNotifications'
import { SpaceSwitcher } from './components/SpaceSwitcher'
import { UpdateProvider } from './contexts/UpdateContext'
import { SpaceProvider } from './contexts/SpaceContext'
import { UpdateToast } from './components/UpdateToast'
import { cn } from '@/lib/utils'
import { AUTOMATIONS } from '@/config/automations'

/**
 * Lazy load app modules for code splitting and faster initial load.
 * Each module is loaded only when navigated to.
 * 
 * ⚠️ TO ADD NEW MODULE:
 * 1. Add lazy import here: const NewApp = lazy(() => import('./apps/new/NewApp'))
 * 2. Add route in <Routes> below
 * 3. Register in src/config/automations.ts
 * 
 * See docs/ADDING-NEW-APPS.md for complete guide.
 */
const HomePage = lazy(() => import('./apps/home/HomePage'))
const LibraryPage = lazy(() => import('./apps/library/LibraryPage'))
const TasksApp = lazy(() => import('./apps/tasks/TasksApp'))
const PackingApp = lazy(() => import('./apps/packing/PackingApp'))
const PublicTransportApp = lazy(() => import('./apps/public-transport/PublicTransportApp'))
const CalisthenicsApp = lazy(() => import('./apps/calisthenics/CalisthenicsApp'))
const ApartmentApp = lazy(() => import('./apps/apartment/ApartmentApp'))
const DotaCoachApp = lazy(() => import('./apps/dota/DotaCoachApp'))
const RecipesApp = lazy(() => import('./apps/recipes/RecipesApp'))

// Groups pages
const GroupsPage = lazy(() => import('./apps/groups/GroupsPage'))
const CreateGroupPage = lazy(() => import('./apps/groups/CreateGroupPage'))
const GroupSettingsPage = lazy(() => import('./apps/groups/GroupSettingsPage'))
const JoinGroupPage = lazy(() => import('./apps/groups/JoinGroupPage'))

/**
 * Loading spinner shown during lazy module loading and auth initialization.
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="relative">
        <div className="w-8 h-8 border-2 border-[var(--primary-muted)] rounded-full" />
        <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-[var(--primary)] rounded-full animate-spin" />
      </div>
    </div>
  )
}

/**
 * Header shown when inside an automation module.
 * Displays back button and module icon/name.
 */
function NavigationHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Check if we're in an automation
  const automation = AUTOMATIONS.find(a => location.pathname.startsWith(a.route))
  
  if (!automation) return null

  const AutomationIcon = automation.icon

  return (
    <div className="border-b border-[var(--border)] px-4 py-4">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            'bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors',
            'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            'border border-[var(--border)]'
          )}
          title="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg",
            `bg-[${automation.color}]/10`
          )}>
            <AutomationIcon className="h-5 w-5" style={{ color: automation.color }} />
          </div>
          <h2 className="font-semibold text-[var(--foreground)]">{automation.name}</h2>
        </div>
      </div>
    </div>
  )
}

/**
 * Bottom navigation bar (mobile-first design).
 * Fixed to bottom of screen with backdrop blur and modern styling.
 * Only shown on root-level pages (Home, Library).
 */
function BottomNav() {
  const location = useLocation()
  
  const navItems = [
    { to: '/', icon: Home, label: 'Home', exact: true },
    { to: '/library', icon: Grid3X3, label: 'Library', exact: false },
  ]

  // Only show on root-level pages
  const showNav = ['/', '/library'].includes(location.pathname)
  if (!showNav) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-4 mb-4">
        <div
          className={cn(
            'max-w-xs mx-auto flex items-center justify-center gap-2 p-2',
            'bg-[var(--surface)]/80 backdrop-blur-xl',
            'border border-[var(--border)] rounded-2xl',
            'shadow-2xl shadow-black/50'
          )}
        >
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200',
                  isActive
                    ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary-glow)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

/**
 * Root App component with routing and layout.
 * 
 * Structure:
 * - UpdateProvider: Checks for app version updates
 * - Authenticated: Protected routes (require sign-in)
 *   - SpaceProvider: Manages active space (multi-tenancy)
 *   - Header: Logo, space switcher, user button
 *   - NavigationHeader: Back button + module info (when in module)
 *   - Main: Content area with routes
 *   - BottomNav: Home/Library navigation
 * - Unauthenticated: Sign-in page
 */
function App() {
  const navigate = useNavigate()
  
  return (
    <UpdateProvider>
      <Authenticated>
        <SpaceProvider>
          <div className="min-h-screen flex flex-col">
            {/* Offline Banner */}
            <OfflineBanner />

            {/* PWA Update Toast */}
            <UpdateToast />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
              <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 transition-transform active:scale-95 hover:opacity-80"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-violet-600">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">
                      <span className="text-[var(--foreground)]">auto</span>
                      <span className="text-[var(--primary)]">-m8</span>
                    </h1>
                  </button>
                  {/* Space Switcher */}
                  <SpaceSwitcher />
                </div>
                <div className="flex items-center gap-3">
                  <Authenticated>
                    <UserButtonWithNotifications />
                  </Authenticated>
                  <Unauthenticated>
                    <SignInButton mode="modal">
                      <button className="text-sm px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[var(--primary-glow)]">
                        Sign in
                      </button>
                    </SignInButton>
                  </Unauthenticated>
                  <AuthLoading>
                    <div className="w-8 h-8 rounded-full bg-[var(--surface)] animate-pulse" />
                  </AuthLoading>
                </div>
              </div>
            </header>

            {/* Automation Header (when in automation) */}
            <NavigationHeader />

            {/* Main content */}
            <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
              <AuthLoading>
                <LoadingSpinner />
              </AuthLoading>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/tasks" element={<TasksApp />} />
                  <Route path="/packing/*" element={<PackingApp />} />
                  <Route path="/transport/*" element={<PublicTransportApp />} />
                  <Route path="/calisthenics/*" element={<CalisthenicsApp />} />
                  <Route path="/apartment" element={<ApartmentApp />} />
                  <Route path="/dota" element={<DotaCoachApp />} />
                  <Route path="/recipes/*" element={<RecipesApp />} />
                  {/* Groups management */}
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/groups/new" element={<CreateGroupPage />} />
                  <Route path="/groups/:groupId" element={<GroupSettingsPage />} />
                  <Route path="/join/:code" element={<JoinGroupPage />} />
                </Routes>
              </Suspense>
            </main>

            {/* Bottom navigation */}
            <BottomNav />
          </div>
        </SpaceProvider>
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen flex flex-col">
          {/* Offline Banner */}
          <OfflineBanner />

          {/* PWA Update Toast */}
          <UpdateToast />

          {/* Header */}
          <header className="sticky top-0 z-40 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 transition-transform active:scale-95 hover:opacity-80 cursor-pointer">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-violet-600">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h1 className="text-lg font-bold tracking-tight">
                    <span className="text-[var(--foreground)]">auto</span>
                    <span className="text-[var(--primary)]">-m8</span>
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SignInButton mode="modal">
                  <button className="text-sm px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[var(--primary-glow)]">
                    Sign in
                  </button>
                </SignInButton>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-violet-600 mb-6 shadow-2xl shadow-[var(--primary-glow)]">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2">
                <span className="text-[var(--foreground)]">auto</span>
                <span className="text-[var(--primary)]">-m8</span>
              </h2>
              <p className="text-[var(--muted)] mb-8 text-center max-w-xs">
                Your personal automation hub for everyday life ✨
              </p>
              <SignInButton mode="modal">
                <button className="px-8 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-[var(--primary-glow)] active:scale-95">
                  Get Started
                </button>
              </SignInButton>
            </div>
          </main>
        </div>
      </Unauthenticated>
    </UpdateProvider>
  )
}

export default App
