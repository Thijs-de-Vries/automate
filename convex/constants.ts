/**
 * Shared constants that can be safely imported in both Convex functions and browser code
 */

// ============================================
// Available icons for spaces (Lucide icon names)
// ============================================
export const SPACE_ICONS = [
  "Home",
  "Users",
  "Heart",
  "Plane",
  "Briefcase",
  "GraduationCap",
  "Gamepad2",
  "Music",
  "Camera",
  "Utensils",
  "Car",
  "TreePine",
  "Dumbbell",
  "Palette",
  "Book",
  "Star",
] as const;

// ============================================
// Dota Coach AI Configuration
// ============================================
export const DOTA_COACH_CONFIG = {
  // OpenRouter model to use for analysis
  // Options: "anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo", etc.
  model: "xiaomi/mimo-v2-flash:free",
  
  // Maximum matches to sync per player
  maxMatchesPerSync: 20,
  
  // Pinecone configuration
  pinecone: {
    indexName: "dota-coach",
    embeddingModel: "multilingual-e5-large",
    topK: 10, // Number of similar notes to retrieve for RAG
  },
} as const;

