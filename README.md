# Automate

A personal PWA (Progressive Web App) for small family use, primarily accessed on iOS and Android devices. Provides automation tools for daily tasks, apartment/shopping management, travel packing, and public transport monitoring.

**Primary Users:** Personal use for you, your girlfriend, and family members  
**Primary Devices:** Mobile (iOS/Android) installed as PWA  
**Design Philosophy:** Mobile-first, feature-rich, modern aesthetics

## Features

### 🧳 Packing App
A comprehensive travel companion to ensure you never forget an item.
- **Trip Management:** Create and manage multiple trips.
- **Categorized Lists:** Organize items by categories (Clothes, Toiletries, Electronics, etc.).
- **Status Tracking:** Toggle items as packed/unpacked.

### 🚆 Public Transport App
Real-time dashboard for monitoring Dutch public transport (NS).
- **Route Monitoring:** Define custom routes with origin, destination, and schedule.
- **Disruption Alerts:** Track maintenance and calamities for your specific routes.
- **Station Data:** Syncs with NS API for up-to-date station information.

### ✅ Tasks App
A simple and effective To-Do list manager.
- **Task Management:** Add, complete, and delete tasks.
- **Progress Tracking:** Visual counter for completed vs. total tasks.

## Tech Stack

| Technology | Purpose | Why? |
|------------|---------|------|
| **React** | Frontend framework | Functional components, hooks, component reusability |
| **Vite** | Build tool | Fast dev server, optimized builds, PWA plugin |
| **TypeScript** | Type safety | Catch errors early, better IDE support |
| **Tailwind CSS** | Styling | Utility-first, mobile-first by default, rapid development |
| **Convex** | Backend/Database | Real-time reactivity, serverless, TypeScript end-to-end |
| **Clerk** | Authentication | Multi-tenant user management, built-in UI |
| **Workbox** | Service Worker | PWA offline support, push notifications |

## Development

### Prerequisites
- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start dev server (Terminal 1)
npm run dev

# Start Convex backend (Terminal 2)
npx convex dev
```

### Available Commands

```bash
npm run dev          # Start Vite dev server
npx convex dev       # Start Convex backend
npm run build        # Build for production
npm run preview      # Preview production build
```

## Documentation

### For AI Assistants
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - Instructions for AI coding assistants
- **[BACKLOG.yaml](BACKLOG.yaml)** - Current issues and tasks

### For Developers
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Comprehensive architecture guide with canonical code references
- **[docs/ADDING-NEW-APPS.md](docs/ADDING-NEW-APPS.md)** - Step-by-step guide for adding new modules

## Project Structure

```
automate/
├── src/
│   ├── apps/           # Feature modules (one per app)
│   ├── components/     # Shared components
│   ├── config/         # App configuration (module registry)
│   ├── contexts/       # React contexts for global state
│   ├── hooks/          # Custom hooks
│   └── lib/            # Utility functions
├── convex/             # Backend (Convex serverless functions)
│   ├── {app}.ts        # Per-app backend functions
│   ├── schema.ts       # Database schema
│   └── notifications.ts # Notification system
├── docs/               # Documentation
└── BACKLOG.yaml        # Issue tracking
```

## Current State

**Production:** Deployed as PWA on iOS and Android  
**Most Used Apps:** Public Transport, Apartment  
**Known Issues:** See [BACKLOG.yaml](BACKLOG.yaml) for current bugs and planned improvements

## Adding New Modules

See [docs/ADDING-NEW-APPS.md](docs/ADDING-NEW-APPS.md) for complete guide.

**Quick overview:**
1. Register in `src/config/automations.ts`
2. Create component in `src/apps/{name}/`
3. Add route in `src/App.tsx`
4. Define schema in `convex/schema.ts`
5. Create backend in `convex/{name}.ts`


## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International Public License (CC BY-NC 4.0)**.
You are free to share and adapt the material for non-commercial purposes, provided you give appropriate credit. See the [LICENSE](LICENSE) file for details.
