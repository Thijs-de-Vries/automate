# Automate Architecture Guide

This document provides a comprehensive overview of the Automate project architecture with canonical references to actual code.

## Table of Contents

- [Project Structure](#project-structure)
- [Module System](#module-system)
- [Convex Backend Patterns](#convex-backend-patterns)
- [Component Patterns](#component-patterns)
- [State Management](#state-management)
- [Authentication & Authorization](#authentication--authorization)
- [PWA & Updates](#pwa--updates)
- [Routing](#routing)
- [Notifications](#notifications)

---

## Project Structure

```
automate/
├── .github/
│   └── copilot-instructions.md    # AI assistant instructions
├── convex/                        # Backend (Convex serverless functions)
│   ├── {app}.ts                   # Per-app backend functions
│   ├── schema.ts                  # Database schema
│   ├── notifications.ts           # Notification system
│   └── _generated/                # Auto-generated types
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md            # This file
│   └── ADDING-NEW-APPS.md         # Module creation guide
├── public/                        # Static assets (PWA icons, manifest)
├── src/
│   ├── apps/                      # Feature modules (one per app)
│   │   ├── {name}/
│   │   │   └── {Name}App.tsx      # Main component
│   ├── components/                # Shared components
│   │   ├── ui/                    # Reusable UI primitives
│   │   ├── OfflineBanner.tsx
│   │   ├── SpaceSwitcher.tsx
│   │   └── UpdateToast.tsx
│   ├── config/
│   │   └── automations.ts         # Module registry (CRITICAL)
│   ├── contexts/                  # React contexts
│   │   ├── SpaceContext.tsx       # Active space state
│   │   └── UpdateContext.tsx      # Version checking
│   ├── hooks/                     # Custom hooks
│   ├── lib/                       # Utility functions
│   ├── App.tsx                    # Root component, routing
│   ├── main.tsx                   # Entry point
│   └── sw.ts                      # Service worker
├── BACKLOG.yaml                   # Issue tracking
├── vite.config.ts                 # Build configuration
└── package.json
```

---

## Module System

**Canonical Reference:** [src/config/automations.ts](../src/config/automations.ts)

### How It Works

All app modules are registered in a centralized `AUTOMATIONS` array. This powers:
- Home page grid
- Navigation
- Notification preferences
- Category organization

### Registration Structure

```typescript
export interface AutomationConfig {
  id: string                        // Unique identifier (kebab-case)
  name: string                      // Display name
  description: string               // Shown on home page
  icon: LucideIcon                  // From lucide-react
  route: string                     // URL path (e.g., "/tasks")
  category: AutomationCategory      // For grouping
  color: string                     // Tailwind color class
  notificationKey?: string          // Maps to notification preferences
  notificationDescription?: string  // Shown in notification settings
}
```

### Adding a New Module (Quick Reference)

See [ADDING-NEW-APPS.md](./ADDING-NEW-APPS.md) for complete guide.

1. Add entry to `AUTOMATIONS` array in `src/config/automations.ts`
2. Create component at `src/apps/{name}/{Name}App.tsx`
3. Add lazy import and route in `src/App.tsx`
4. Add table(s) to `convex/schema.ts`
5. Create backend functions in `convex/{name}.ts`

### Categories

Available categories defined in `automations.ts`:
- `productivity` (e.g., Tasks)
- `transport` (e.g., Public Transport)
- `travel` (e.g., Packing)
- `fitness` (e.g., Calisthenics)
- `home` (e.g., Apartment)
- `utilities`

---

## Convex Backend Patterns

**Canonical References:**
- **Simple:** [convex/tasks.ts](../convex/tasks.ts)
- **Complex:** [convex/apartment.ts](../convex/apartment.ts)
- **Schema:** [convex/schema.ts](../convex/schema.ts)

### Query Pattern (Read-Only)

```typescript
export const list = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    // Always filter by spaceId for multi-tenancy
    const items = await ctx.db
      .query("table_name")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    
    return items;
  },
});
```

**Used in React:**
```typescript
const items = useQuery(api.module.list, 
  activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
) ?? [];
```

### Mutation Pattern (Write)

```typescript
export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    field: v.string(),
    // ... other fields
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Create document
    const id = await ctx.db.insert("table_name", {
      ...args,
      userId: identity.subject,
      createdAt: Date.now(),
    });

    return id;
  },
});
```

**Used in React:**
```typescript
const createItem = useMutation(api.module.create);

await createItem({ spaceId, field: value });
```

### Action Pattern (External APIs)

```typescript
export const fetchExternalData = action({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // Can make fetch() calls, use non-deterministic operations
    const response = await fetch("https://api.example.com/data");
    const data = await response.json();
    
    // Can call mutations to store results
    await ctx.runMutation(api.module.storeFetchedData, { data });
    
    return data;
  },
});
```

### Schema Patterns

**Canonical Reference:** [convex/schema.ts](../convex/schema.ts)

```typescript
// Multi-tenant table (filtered by spaceId)
table_name: defineTable({
  field: v.string(),
  spaceId: v.id("spaces"),       // REQUIRED for multi-tenancy
  userId: v.string(),             // Clerk user ID
  createdAt: v.number(),
}).index("by_space", ["spaceId"])
  .index("by_space_and_field", ["spaceId", "field"]),
```

**Key Patterns:**
- Always include `spaceId` for multi-tenancy
- Use `v.id("table_name")` for foreign keys
- Add indexes for common queries
- Use `v.union()` for enums/status fields
- Use `v.optional()` for nullable fields

---

## Component Patterns

**Canonical References:**
- **Minimal:** [src/apps/tasks/TasksApp.tsx](../src/apps/tasks/TasksApp.tsx)
- **Feature-rich:** [src/apps/apartment/ApartmentApp.tsx](../src/apps/apartment/ApartmentApp.tsx)
- **UI Primitives:** [src/components/ui/](../src/components/ui/)

### Mobile-First Layout

```tsx
<div className="min-h-screen bg-background pb-20">
  {/* Always account for bottom nav (pb-20) */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {/* Responsive padding and max-width */}
    {/* Content */}
  </div>
</div>
```

### Responsive Breakpoints

Use Tailwind breakpoints in order:
- **Default:** Mobile (375px+)
- **`sm:`** Tablet (640px+)
- **`md:`** Small desktop (768px+)
- **`lg:`** Large desktop (1024px+)

Example:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Loading States

```tsx
const data = useQuery(api.module.list, args);

if (data === undefined) {
  return <div>Loading...</div>;
}

if (data.length === 0) {
  return <div>No items yet</div>;
}
```

### Error Handling

⚠️ **Current pattern (needs improvement):**
```tsx
const data = useQuery(api.module.list, args) ?? [];
// Masks errors - can't tell if failed vs. empty
```

✅ **Better pattern (see PublicTransportApp):**
```tsx
const data = useQuery(api.module.list, args);

if (data === undefined) return <div>Loading...</div>;
if (data instanceof Error) return <ErrorCard error={data} />;
```

---

## State Management

**Canonical Reference:** [src/contexts/SpaceContext.tsx](../src/contexts/SpaceContext.tsx)

### Space Context (Multi-Tenancy)

The `SpaceContext` manages which "space" (household/group) is active:

```typescript
const { activeSpaceId } = useActiveSpace();

// Pass to all queries/mutations
const items = useQuery(api.module.list, 
  activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
);
```

**Key Points:**
- All data is scoped to a space (like Slack workspaces)
- User can switch between spaces via `SpaceSwitcher` component
- Queries return `undefined` until space is loaded
- Use `'skip'` parameter when `activeSpaceId` is null

### Local State

Use React hooks:
```tsx
const [isOpen, setIsOpen] = useState(false);
const [filter, setFilter] = useState<FilterType>('all');
```

For complex state, consider `useReducer` or extracting to custom hook.

---

## Authentication & Authorization

**Tech:** Clerk (JWT-based)

### Frontend (React)

```tsx
import { useUser } from '@clerk/clerk-react';

function MyComponent() {
  const { user } = useUser();
  
  if (!user) return <SignIn />;
  
  // user.id = Clerk user ID
  // user.fullName, user.imageUrl, etc.
}
```

### Backend (Convex)

```typescript
export const myMutation = mutation({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject; // Clerk user ID
    // ...
  },
});
```

### Authorization Patterns

**Check admin role (Apartment app example):**
```typescript
// In convex function
const member = await ctx.db
  .query("space_members")
  .withIndex("by_space_and_user", (q) => 
    q.eq("spaceId", args.spaceId).eq("userId", userId)
  )
  .first();

if (!member || (member.role !== "admin" && member.role !== "creator")) {
  throw new Error("Unauthorized");
}
```

---

## PWA & Updates

**Canonical References:**
- **Service Worker:** [src/sw.ts](../src/sw.ts)
- **Config:** [vite.config.ts](../vite.config.ts)
- **Version Check:** [src/hooks/useVersionCheck.ts](../src/hooks/useVersionCheck.ts)
- **Update Context:** [src/contexts/UpdateContext.tsx](../src/contexts/UpdateContext.tsx)

### Service Worker (sw.ts)

Handles:
- **Precaching:** Static assets via Workbox
- **Push notifications:** `push` event listener
- **Notification clicks:** `notificationclick` event
- **Immediate activation:** `skipWaiting()` + `clients.claim()`

### Update Strategy

⚠️ **Current implementation (fragmented):**
1. Version checking via Convex (`useVersionCheck`)
2. Service worker updates via Workbox (separate)
3. Not unified - can cause mismatched assets

✅ **See BACKLOG.yaml issue: `update-mechanism-fragmented`**

### Build Configuration

```typescript
// vite.config.ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    swSrc: 'src/sw.ts',
    swDest: 'dist/sw.js',
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
  },
})
```

### Version Tracking

Version stored in `convex/appMetadata` table, synced from Git SHA via `VITE_APP_VERSION` env var.

---

## Routing

**Canonical Reference:** [src/App.tsx](../src/App.tsx)

### Structure

```tsx
<BrowserRouter>
  <Routes>
    {/* Public routes */}
    <Route path="/join/:code" element={<JoinGroupPage />} />
    
    {/* Protected routes (require auth) */}
    <Route path="/" element={<ProtectedLayout />}>
      <Route index element={<HomePage />} />
      
      {/* App routes (lazy loaded) */}
      <Route path="/tasks" element={<TasksApp />} />
      <Route path="/apartment" element={<ApartmentApp />} />
      {/* ... */}
    </Route>
  </Routes>
</BrowserRouter>
```

### Lazy Loading

```tsx
const TasksApp = lazy(() => import('./apps/tasks/TasksApp'));
```

Wrapped in `<Suspense>` at route level for better UX.

### Navigation

Bottom navigation bar (mobile-first):
```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-background border-t">
  {/* Links to home, library, settings, etc. */}
</nav>
```

⚠️ **Known issue:** Logo doesn't navigate to home. See `BACKLOG.yaml`.

---

## Notifications

**Canonical References:**
- **Backend:** [convex/notifications.ts](../convex/notifications.ts)
- **Node actions:** [convex/notificationsNode.ts](../convex/notificationsNode.ts)
- **Frontend hook:** [src/hooks/usePushNotifications.ts](../src/hooks/usePushNotifications.ts)

### Architecture

1. **User subscribes** via `usePushNotifications` hook
2. **Subscription stored** in `pushSubscriptions` table
3. **Backend sends** via `sendPushNotification` action (uses web-push library)
4. **Service worker receives** and displays notification

### Sending Notifications (Backend)

```typescript
import { sendPushNotification } from './notifications';

// In your mutation/action
await sendPushNotification(ctx, {
  userId: targetUserId,
  title: "New Item Suggested",
  body: "Someone added a new item",
  icon: "/icon-192x192.png",
  tag: "apartment-123", // For replacing old notifications
  data: {
    url: "/apartment",
    type: "apartment_suggestion",
  },
});
```

### Checking User Preferences

```typescript
// Query user's notification preferences
const prefs = await ctx.db
  .query("space_members")
  .withIndex("by_space_and_user", (q) => 
    q.eq("spaceId", spaceId).eq("userId", userId)
  )
  .first();

if (prefs?.notificationPreferences?.apartment) {
  // User opted in, send notification
}
```

⚠️ **Known issue:** Notifications currently broken. See `BACKLOG.yaml`.

---

## Common Patterns & Best Practices

### Multi-Tenancy (Spaces)

✅ **Always filter by spaceId:**
```typescript
.withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
```

❌ **Don't forget space filtering - data leak risk!**

### Error Handling

✅ **Do:**
- Show user-friendly error messages
- Provide retry buttons
- Log errors to console for debugging

❌ **Don't:**
- Use `alert()` for errors (use toast/inline messages)
- Silently fail mutations (catch-log-ignore pattern)
- Mask query errors with `?? []` without feedback

### Mobile-First

✅ **Do:**
- Test on 375px width minimum
- Use bottom navigation, not top
- Prefer inline actions over modals
- Use large touch targets (44px minimum)

❌ **Don't:**
- Assume desktop viewport
- Create hover-only interactions
- Use tiny buttons or links

### Performance

✅ **Do:**
- Lazy load app routes
- Index frequently queried fields

❌ **Don't:**
- Query all data on page load
- Re-query data you already have
- Forget to add indexes to schema

---

## Decision Records

### Why Convex?

- Real-time reactivity (queries auto-update)
- Serverless (no backend maintenance)
- Built-in auth integration
- TypeScript end-to-end

### Why Clerk?

- Easy multi-tenant user management
- Built-in UI components
- JWT tokens work seamlessly with Convex

### Why PWA instead of native?

- Single codebase for iOS/Android
- No app store approval process
- Instant updates (no version delays)
- Still works offline with service worker

### Why Tailwind CSS?

- Utility-first = fast development
- Mobile-first by default
- Consistent design system
- Small bundle size (PurgeCSS)

---

## Future Improvements

See `BACKLOG.yaml` for current issues and planned enhancements.

**High Priority:**
- Fix Convex connection indicator
- Unify update mechanism
- Improve error handling patterns
- Simplify apartment workflow

**Medium Priority:**
- Add React error boundaries
- Implement toast notification system
- Better loading states (skeletons)
- Logo navigation to home

**Low Priority:**
None currently.
