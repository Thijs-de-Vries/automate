import {
  Train,
  CheckSquare,
  Luggage,
  Dumbbell,
  Home,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type AutomationCategory = 
  | 'transport'
  | 'productivity'
  | 'travel'
  | 'fitness'
  | 'home'
  | 'utilities'

export interface AutomationConfig {
  id: string
  name: string
  description: string
  icon: LucideIcon
  route: string
  category: AutomationCategory
  color: string // Tailwind color class for accent
  notificationKey?: 'tasks' | 'packing' | 'transport' | 'calisthenics' // Key for notification preferences
  notificationDescription?: string // Description for notification settings
}

export interface CategoryConfig {
  id: AutomationCategory
  name: string
  icon: LucideIcon
}

export const CATEGORIES: CategoryConfig[] = [
  { id: 'productivity', name: 'Productivity', icon: CheckSquare },
  { id: 'transport', name: 'Transport', icon: Train },
  { id: 'travel', name: 'Travel', icon: Luggage },
  { id: 'fitness', name: 'Fitness', icon: Dumbbell },
  { id: 'home', name: 'Home', icon: Home },
  { id: 'utilities', name: 'Utilities', icon: Zap },
]

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
]

export function getAutomationsByCategory(category: AutomationCategory): AutomationConfig[] {
  return AUTOMATIONS.filter(a => a.category === category)
}

export function getAutomationById(id: string): AutomationConfig | undefined {
  return AUTOMATIONS.find(a => a.id === id)
}

export function getCategoryById(id: AutomationCategory): CategoryConfig | undefined {
  return CATEGORIES.find(c => c.id === id)
}

// Get automations that support notifications (have notificationKey defined)
export function getNotifiableAutomations(): AutomationConfig[] {
  return AUTOMATIONS.filter(a => a.notificationKey !== undefined)
}
