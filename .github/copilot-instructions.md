# GitHub Copilot Instructions for Automate Project

## Project Overview

**Automate** is a personal PWA (Progressive Web App) for small family use, primarily accessed on iOS and Android devices. It provides automation tools for daily tasks, apartment/shopping management, travel packing, and public transport monitoring.

**Primary Users:** You, your girlfriend, and family members  
**Primary Devices:** Mobile (iOS/Android) installed as PWA  
**Design Philosophy:** Mobile-first, feature-rich, modern aesthetics

## Tech Stack

| Technology | Purpose | Version/Notes |
|------------|---------|---------------|
| **React** | Frontend framework | Functional components, hooks |
| **Vite** | Build tool | Fast dev server, PWA plugin |
| **TypeScript** | Type safety | Strict mode |
| **Tailwind CSS** | Styling | Utility-first, custom theme |
| **Convex** | Backend/Database | Real-time, serverless functions |
| **Clerk** | Authentication | User management, spaces |
| **Workbox** | Service Worker | PWA offline support |

## Mandatory Pre-Flight Checklist

**BEFORE starting any task, AI MUST:**

1. ✅ **Read `BACKLOG.yaml`** - Check for related issues
2. ✅ **Identify affected files** - Understand what will change
3. ✅ **Read relevant `docs/ARCHITECTURE.md` sections** - Understand patterns
4. ✅ **Check canonical references** - See existing implementations
5. ✅ **Consider mobile-first** - Primary use case is mobile PWA

## Mandatory Completion Checklist

**AFTER completing any task, AI MUST:**

1. ✅ **Update changed documentation** - If you modified files referenced in docs, update those doc sections
2. ✅ **Update dependent docs** - Update docs that reference your changes (one level deep)
3. ✅ **Remove completed BACKLOG issues** - Delete any issues you've fully resolved
4. ✅ **Update inline JSDoc** - If you modified files with JSDoc, keep comments in sync
5. ✅ **Verify mobile-first** - Ensure changes work well on small screens

## Canonical References

### Module System
- **Registration:** `src/config/automations.ts` - How apps are registered
- **Simple App:** `src/apps/tasks/TasksApp.tsx` - Minimal app example
- **Complex App:** `src/apps/apartment/ApartmentApp.tsx` - Feature-rich app example

### Backend (Convex)
- **Simple Pattern:** `convex/tasks.ts` - Basic CRUD operations
- **Complex Pattern:** `convex/apartment.ts` - Approval workflow, comments, notifications
- **Schema:** `convex/schema.ts` - Database tables and relationships
- **Notifications:** `convex/notifications.ts` - How to send notifications

### Frontend Patterns
- **Routing:** `src/App.tsx` - How routes are structured
- **Context:** `src/contexts/SpaceContext.tsx` - State management pattern
- **Components:** `src/components/ui/` - Reusable UI components

### PWA & Infrastructure
- **Service Worker:** `src/sw.ts` - Push notifications, caching
- **Build Config:** `vite.config.ts` - PWA plugin, build settings
- **Updates:** `src/contexts/UpdateContext.tsx` - Version checking

## Key Architectural Patterns

### Adding a New App Module
1. Add entry to `AUTOMATIONS` array in `src/config/automations.ts`
2. Create component in `src/apps/{name}/{Name}App.tsx`
3. Add lazy import and route in `src/App.tsx`
4. Add table to schema in `convex/schema.ts`
5. Create backend functions in `convex/{name}.ts`

**Full guide:** `docs/ADDING-NEW-APPS.md`

### Convex Patterns
- **Queries:** Read-only, reactive, use `useQuery` hook
- **Mutations:** Write operations, use `useMutation` hook
- **Actions:** External API calls, non-deterministic operations
- **Validation:** Use `v` (convex/values) for argument validation
- **Auth:** Get user via `ctx.auth.getUserIdentity()`
- **Spaces:** Filter data by `spaceId` for multi-tenancy

### Component Patterns
- **Mobile-first:** Use `sm:`, `md:`, `lg:` breakpoints appropriately
- **Loading states:** Show skeletons or spinners during data fetch
- **Error handling:** Display user-friendly error messages
- **Empty states:** Helpful messages when no data exists
- **Optimistic updates:** Update UI immediately, sync to server

### Notification Patterns
- **Check opt-in:** Query `notifications.getPreferences` first
- **Target users:** Only notify users with permission
- **Use tags:** Group related notifications for replacement
- **Include actions:** Add action URLs for notification clicks

## Common Pitfalls

❌ **Don't:** Use `alert()` for errors - use toast notifications  
❌ **Don't:** Forget mobile breakpoints - default should work on 375px width  
❌ **Don't:** Skip null checks - queries can return `undefined`  
❌ **Don't:** Hardcode user IDs - use `ctx.auth.getUserIdentity()`  
❌ **Don't:** Forget to filter by `spaceId` - data is multi-tenant  
❌ **Don't:** Create modals for everything - prefer inline interactions on mobile  

✅ **Do:** Use `useQuery` with `?? []` fallback for lists  
✅ **Do:** Add loading states to all mutation buttons  
✅ **Do:** Use Tailwind utility classes, not inline styles  
✅ **Do:** Follow existing patterns from canonical references  
✅ **Do:** Test on mobile viewport (375px minimum)  
✅ **Do:** Keep components under 300 lines - split if larger  

## File Organization

```
src/
  apps/{name}/           - App modules (one folder per app)
  components/            - Shared components
    ui/                  - UI primitives (Button, Card, Input)
  config/                - App configuration
  contexts/              - React contexts for global state
  hooks/                 - Custom hooks
  lib/                   - Utility functions

convex/
  {name}.ts              - Backend functions per app
  schema.ts              - Database schema
  notifications.ts       - Notification system
  _generated/            - Auto-generated types (don't edit)
```

## Documentation Files

- **`BACKLOG.yaml`** - Current issues and tasks
- **`docs/ARCHITECTURE.md`** - Detailed architecture guide
- **`docs/ADDING-NEW-APPS.md`** - Step-by-step module creation
- **`README.md`** - Project overview

## Current Known Issues

See `BACKLOG.yaml` for up-to-date list of issues and their priorities.

## Development Commands

```bash
npm run dev          # Start dev server
npx convex dev       # Start Convex backend (separate terminal)
npm run build        # Build for production
npm run preview      # Preview production build
```

## Remember

- This is a **personal project** for small family use
- **Mobile-first** is critical - most usage is on phones
- **Feature-rich** is good - users like comprehensive tools
- Keep the **modern aesthetic** with clean UI
- **Real-time updates** via Convex are expected behavior
- **Notifications** should work but currently broken (see BACKLOG)

---

**When in doubt:** Check canonical references, follow existing patterns, ask clarifying questions.
