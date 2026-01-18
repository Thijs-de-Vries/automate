import {
  Train,
  CheckSquare,
  Luggage,
  Dumbbell,
  Home,
  Zap,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

/**
 * Category types for organizing automation modules.
 * Each category represents a different domain of functionality.
 */
export type AutomationCategory = 
  | 'transport'    // Public transport, travel routes
  | 'productivity' // Tasks, todos, organization
  | 'travel'       // Packing lists, trip planning
  | 'fitness'      // Workouts, exercise tracking
  | 'home'         // Household management, shopping
  | 'utilities'    // General purpose tools
  | 'gaming'       // Game coaching and analysis

/**
 * Configuration for a single automation module.
 * 
 * Each module is a self-contained feature accessible via the home page grid.
 * Modules are lazy-loaded routes with their own backend functions and UI.
 * 
 * @example
 * {
 *   id: 'tasks',
 *   name: 'Tasks',
 *   description: 'Shared task lists and todos',
 *   icon: CheckSquare,
 *   route: '/tasks',
 *   category: 'productivity',
 *   color: 'text-violet-400',
 *   notificationKey: 'tasks',
 *   notificationDescription: 'When tasks are completed'
 * }
 */
export interface AutomationConfig {
  /** Unique identifier (kebab-case). Used for lookups and analytics. */
  id: string
  
  /** Display name shown in UI (title case). */
  name: string
  
  /** Brief description shown on home page cards. */
  description: string
  
  /** Icon from lucide-react library. */
  icon: LucideIcon
  
  /** URL path for this module (must match route in App.tsx). */
  route: string
  
  /** Category for grouping on home page. */
  category: AutomationCategory
  
  /** Tailwind color class for visual identity (e.g., 'text-blue-400'). */
  color: string
  
  /** 
   * Key for notification preferences in space_members table.
   * If undefined, this module doesn't support notifications.
   */
  notificationKey?: 'tasks' | 'packing' | 'transport' | 'calisthenics' | 'apartment'
  
  /** Human-readable description for notification settings page. */
  notificationDescription?: string
}

export interface CategoryConfig {
  id: AutomationCategory
  name: string
  icon: LucideIcon
}

/**
 * Available categories for organizing modules.
 * Used for filtering and grouping on the home page.
 */
export const CATEGORIES: CategoryConfig[] = [
  { id: 'productivity', name: 'Productivity', icon: CheckSquare },
  { id: 'transport', name: 'Transport', icon: Train },
  { id: 'travel', name: 'Travel', icon: Luggage },
  { id: 'fitness', name: 'Fitness', icon: Dumbbell },
  { id: 'gaming', name: 'Gaming', icon: Trophy },
  { id: 'home', name: 'Home', icon: Home },
  { id: 'utilities', name: 'Utilities', icon: Zap },
]

/**
 * Central registry of all automation modules.
 * 
 * ⚠️ TO ADD A NEW MODULE:
 * 1. Add entry to this array
 * 2. Create component in src/apps/{name}/{Name}App.tsx
 * 3. Add lazy import and route in src/App.tsx
 * 4. Add table to schema in convex/schema.ts
 * 5. Create backend functions in convex/{name}.ts
 * 
 * See docs/ADDING-NEW-APPS.md for complete guide.
 */
export const AUTOMATIONS: AutomationConfig[] = [
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'Shared task lists and todos',
    icon: CheckSquare,
    route: '/tasks',
    category: 'productivity',
    color: 'text-violet-400',
    notificationKey: 'tasks',
    notificationDescription: 'When tasks are completed',
  },
  {
    id: 'public-transport',
    name: 'Train Disruptions',
    description: 'Monitor NS train disruptions',
    icon: Train,
    route: '/transport',
    category: 'transport',
    color: 'text-blue-400',
    notificationKey: 'transport',
    notificationDescription: 'Train disruption alerts',
  },
  {
    id: 'packing',
    name: 'Packing Lists',
    description: 'Trip packing checklists',
    icon: Luggage,
    route: '/packing',
    category: 'travel',
    color: 'text-amber-400',
    notificationKey: 'packing',
    notificationDescription: 'Packing list updates',
  },
  {
    id: 'calisthenics',
    name: 'Calisthenics',
    description: 'Workout tracking',
    icon: Dumbbell,
    route: '/calisthenics',
    category: 'fitness',
    color: 'text-green-400',
    notificationKey: 'calisthenics',
    notificationDescription: 'Workout updates',
  },
  {
    id: 'apartment',
    name: 'Apartment',
    description: 'Track items for your new home',
    icon: Home,
    route: '/apartment',
    category: 'home',
    color: 'text-pink-400',
    notificationKey: 'apartment',
    notificationDescription: 'Item suggestions and updates',
  },
  {
    id: 'dota-coach',
    name: 'Dota Coach',
    description: 'AI-powered match analysis with RAG',
    icon: Trophy,
    route: '/dota',
    category: 'gaming',
    color: 'text-orange-400',
  },
]

// ============================================
// Utility Functions
// ============================================

/**
 * Get all automations in a specific category.
 * Useful for filtered views and category pages.
 */
export function getAutomationsByCategory(category: AutomationCategory): AutomationConfig[] {
  return AUTOMATIONS.filter(a => a.category === category)
}

/**
 * Look up automation config by unique ID.
 * Returns undefined if not found.
 */
export function getAutomationById(id: string): AutomationConfig | undefined {
  return AUTOMATIONS.find(a => a.id === id)
}

/**
 * Look up category config by ID.
 * Returns undefined if not found.
 */
export function getCategoryById(id: AutomationCategory): CategoryConfig | undefined {
  return CATEGORIES.find(c => c.id === id)
}

/**
 * Get all automations that support push notifications.
 * Used for notification settings page.
 */
export function getNotifiableAutomations(): AutomationConfig[] {
  return AUTOMATIONS.filter(a => a.notificationKey !== undefined)
}
