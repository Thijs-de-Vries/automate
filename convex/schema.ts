import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // SPACES - Collaborative groups/households
  // ============================================
  
  // Spaces (called "Groups" in frontend)
  spaces: defineTable({
    displayName: v.string(),           // User-customizable name
    iconName: v.string(),              // Lucide icon name (e.g., "Home", "Users", "Plane")
    isPersonal: v.boolean(),           // true = user's personal space (cannot be deleted)
    createdBy: v.string(),             // Clerk user ID of creator
    createdAt: v.number(),
  }).index("by_creator", ["createdBy"]),

  // Space members with roles and notification preferences
  space_members: defineTable({
    spaceId: v.id("spaces"),
    userId: v.string(),                // Clerk user ID
    userName: v.optional(v.string()),  // Display name from Clerk
    userImageUrl: v.optional(v.string()), // Avatar URL from Clerk
    role: v.union(
      v.literal("creator"),            // Original creator - full control
      v.literal("admin"),              // Can manage members, edit space
      v.literal("member")              // Can use, cannot manage
    ),
    notificationPreferences: v.object({
      tasks: v.boolean(),              // Opt-in per module
      packing: v.boolean(),
      transport: v.boolean(),
      calisthenics: v.boolean(),
      apartment: v.optional(v.boolean()), // Optional for backward compatibility
    }),
    joinedAt: v.number(),
  }).index("by_space", ["spaceId"])
    .index("by_user", ["userId"])
    .index("by_space_and_user", ["spaceId", "userId"]),

  // Invite codes for joining spaces
  space_invites: defineTable({
    spaceId: v.id("spaces"),
    code: v.string(),                  // Format: join-m8te-XXXXX
    createdBy: v.string(),             // Clerk user ID
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Optional expiry
    maxUses: v.optional(v.number()),   // Optional use limit
    useCount: v.number(),              // Track uses
  }).index("by_space", ["spaceId"])
    .index("by_code", ["code"]),

  // ============================================
  // User Preferences - per user settings
  // ============================================
  userPreferences: defineTable({
    clerkId: v.string(),               // Clerk user ID
    favoriteAutomations: v.array(v.string()), // Ordered list of automation IDs
    activeSpaceId: v.optional(v.id("spaces")), // Last active space
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // Tasks app tables
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
    userId: v.optional(v.string()),    // Creator (optional for migration)
    spaceId: v.optional(v.id("spaces")), // Which space this belongs to (optional for migration)
  }).index("by_space", ["spaceId"]),

  // Packing app tables
  packing_trips: defineTable({
    name: v.string(),
    createdAt: v.number(),
    userId: v.optional(v.string()),    // Creator (optional for migration)
    spaceId: v.optional(v.id("spaces")), // Which space this belongs to (optional for migration)
  }).index("by_space", ["spaceId"]),

  packing_items: defineTable({
    tripId: v.id("packing_trips"),
    text: v.string(),
    category: v.string(), // "clothes", "toiletries", "electronics", "documents", "other"
    isPacked: v.boolean(),
    createdAt: v.number(),
  }).index("by_trip", ["tripId"]),

  // ============================================
  // Public Transport app tables - shared by all users
  // ============================================

  // Cached stations from NS API - synced periodically
  pt_stations: defineTable({
    code: v.string(), // e.g., "GVC", "UTR", "ASD"
    uicCode: v.string(),
    nameLong: v.string(), // e.g., "Den Haag Centraal"
    nameMedium: v.string(),
    nameShort: v.string(),
    synonyms: v.array(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    country: v.string(),
  }).index("by_code", ["code"])
    .index("by_uic_code", ["uicCode"]),

  // User-defined routes to monitor for disruptions
  pt_routes: defineTable({
    name: v.string(),                  // e.g., "Commute to Utrecht"
    originCode: v.string(),            // Station code, e.g., "GVC"
    originName: v.string(),            // Display name, e.g., "Den Haag Centraal"
    destinationCode: v.string(),
    destinationName: v.string(),
    scheduleDays: v.array(v.number()), // 0-6 (Sun-Sat)
    departureTime: v.string(),         // "HH:MM" format
    urgencyLevel: v.union(v.literal("normal"), v.literal("important")),
    createdAt: v.number(),
    userId: v.optional(v.string()),    // Creator (optional for migration)
    spaceId: v.optional(v.id("spaces")), // Which space this belongs to (optional for migration)
    // TODO: Add one-off date support in future
    // oneOffDate: v.optional(v.string()), // "YYYY-MM-DD" for single trips
    // Notification deduplication
    lastNotificationHash: v.optional(v.string()),
    lastNotificationSentAt: v.optional(v.number()),
  }).index("by_space", ["spaceId"]),

  // Stations on each route (for checking disruptions at all intermediate stops)
  pt_route_stations: defineTable({
    routeId: v.id("pt_routes"),
    stationCode: v.string(),
    stationName: v.string(),
    order: v.number(), // 0 = origin, 1, 2, ..., n = destination
  }).index("by_route", ["routeId"]),

  // Cached disruptions per route
  pt_disruptions: defineTable({
    routeId: v.id("pt_routes"),
    disruptionId: v.string(), // NS API disruption ID
    type: v.string(), // "MAINTENANCE", "DISRUPTION", "CALAMITY"
    title: v.string(),
    description: v.string(),
    period: v.string(), // Human-readable period text
    advice: v.optional(v.string()),
    additionalTravelTimeLabel: v.optional(v.string()),
    additionalTravelTimeShortLabel: v.optional(v.string()),
    additionalTravelTimeMin: v.optional(v.number()),
    additionalTravelTimeMax: v.optional(v.number()),
    causeLabel: v.optional(v.string()),
    impactValue: v.optional(v.number()),
    alternativeTransportLabel: v.optional(v.string()),
    affectedStations: v.array(v.string()), // Station codes affected
    lastSeen: v.number(), // Timestamp when last seen in API
    contentHash: v.string(), // Hash to detect changes
    isActive: v.boolean(), // false = moved to "old disruptions"
  }).index("by_route", ["routeId"])
    .index("by_route_active", ["routeId", "isActive"]),

  // Route status for badge tracking
  pt_route_status: defineTable({
    routeId: v.id("pt_routes"),
    lastCheckedAt: v.number(),
    hasActiveDisruptions: v.boolean(),
    changedSinceLastView: v.boolean(), // true = show red badge
  }).index("by_route", ["routeId"]),

  // ============================================
  // Push Notification Subscriptions
  // ============================================
  pushSubscriptions: defineTable({
    endpoint: v.string(), // Push service URL
    p256dh: v.string(), // Public key for encryption
    auth: v.string(), // Auth secret
    userId: v.string(), // Clerk user ID
    userAgent: v.optional(v.string()), // For device identification
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  // Calisthenics app tables - per user
  calisthenics: defineTable({
    exercise: v.string(),
    reps: v.number(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
    userId: v.string(),
    spaceId: v.optional(v.id("spaces")), // Which space this belongs to (optional for migration)
  }).index("by_user", ["userId"])
    .index("by_space", ["spaceId"]),

  // ============================================
  // Apartment app tables
  // ============================================
  apartment_items: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    purchaseUrl: v.optional(v.string()),
    category: v.union(
      v.literal("Kitchen"),
      v.literal("Living room"),
      v.literal("Desk"),
      v.literal("Bedroom"),
      v.literal("Hallway"),
      v.literal("Closets"),
      v.literal("Toilet"),
      v.literal("Bathroom"),
      v.literal("Storage"),
      v.literal("Other")
    ),
    estimatedPrice: v.optional(v.number()),
    actualPrice: v.optional(v.number()),
    urgency: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("ordered"),
      v.literal("delivered")
    ),
    submittedBy: v.string(),          // Clerk user ID
    submittedByName: v.optional(v.string()), // Display name
    approvedBy: v.optional(v.string()),
    approvedByName: v.optional(v.string()),
    rejectedBy: v.optional(v.string()),
    rejectedByName: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    orderedDate: v.optional(v.number()),
    deliveredDate: v.optional(v.number()),
    spaceId: v.id("spaces"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_space", ["spaceId"])
    .index("by_space_and_status", ["spaceId", "status"]),

  apartment_comments: defineTable({
    itemId: v.id("apartment_items"),
    userId: v.string(),              // Clerk user ID
    userName: v.optional(v.string()), // Display name
    text: v.string(),
    reactions: v.optional(v.object({
      thumbsUp: v.array(v.string()),    // Array of user IDs who reacted
      heart: v.array(v.string()),
      laugh: v.array(v.string()),
      wow: v.array(v.string()),
      sad: v.array(v.string()),
      pray: v.array(v.string()),
    })),
    createdAt: v.number(),
  }).index("by_item", ["itemId"]),

  // ============================================
  // App Metadata - for version tracking
  // ============================================
  appMetadata: defineTable({
    key: v.string(),      // "app_version"
    value: v.string(),    // Git commit hash (7 chars)
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ============================================
  // Dota Coach - AI-powered match analysis
  // ============================================
  
  // Full match data from OpenDota API
  dotaMatches: defineTable({
    matchId: v.string(), // OpenDota match ID
    playerId: v.string(), // Clerk user ID
    accountId: v.string(), // Steam32 account ID
    matchData: v.any(), // Full match JSON from OpenDota
    heroId: v.number(),
    heroName: v.string(),
    won: v.boolean(),
    duration: v.number(), // seconds
    startTime: v.number(), // Unix timestamp
    gameMode: v.number(),
    lobbyType: v.number(),
    isAnalyzed: v.boolean(),
    analysisFailed: v.optional(v.boolean()), // True if analysis was attempted but failed
    fetchedAt: v.number(),
  }).index("by_player", ["playerId"])
    .index("by_player_analyzed", ["playerId", "isAnalyzed"])
    .index("by_player_time", ["playerId", "startTime"])
    .index("by_match_id", ["matchId"]),

  // AI-generated coaching analysis per match
  dotaAnalyses: defineTable({
    matchId: v.id("dotaMatches"),
    playerId: v.string(), // Clerk user ID
    draftAnalysis: v.string(),
    earlyGameAnalysis: v.string(),
    midGameAnalysis: v.string(),
    lateGameAnalysis: v.string(),
    overallSummary: v.string(),
    analyzedAt: v.number(),
    modelUsed: v.string(), // e.g., "gpt-4-turbo"
  }).index("by_match", ["matchId"])
    .index("by_player", ["playerId"]),

  // Player profile with hero pool and persistent patterns
  dotaPlayerProfiles: defineTable({
    playerId: v.string(), // Clerk user ID
    steamAccountId: v.optional(v.string()), // Steam32 account ID
    heroPool: v.array(v.object({
      heroId: v.number(),
      heroName: v.string(),
      proficiency: v.string(), // "main", "comfortable", "learning"
      notes: v.optional(v.string()),
    })),
    playstyle: v.optional(v.string()), // General playstyle notes
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    preferredRoles: v.array(v.string()), // "carry", "mid", "offlane", "support", "roaming"
    updatedAt: v.number(),
  }).index("by_player", ["playerId"]),

  // Coaching notes for RAG with Pinecone vector IDs
  dotaCoachingNotes: defineTable({
    playerId: v.string(), // Clerk user ID
    matchId: v.optional(v.id("dotaMatches")),
    heroId: v.optional(v.number()),
    heroName: v.optional(v.string()),
    phase: v.optional(v.string()), // "draft", "early", "mid", "late"
    category: v.string(), // "laning", "itemization", "positioning", "map_awareness", etc.
    observation: v.string(), // The actual coaching note
    pineconeId: v.string(), // Vector ID in Pinecone
    timestamp: v.number(),
  }).index("by_player", ["playerId"])
    .index("by_player_hero", ["playerId", "heroId"])
    .index("by_player_phase", ["playerId", "phase"]),

  // Profile update suggestions from AI
  dotaProfileSuggestions: defineTable({
    playerId: v.string(), // Clerk user ID
    suggestionType: v.string(), // "add_strength", "add_weakness", "remove_weakness", "update_hero_pool"
    suggestion: v.string(), // Human-readable suggestion
    reasoning: v.string(), // Why the AI suggests this
    suggestedData: v.optional(v.any()), // Structured data for the update (optional - AI doesn't always provide)
    status: v.string(), // "pending", "accepted", "dismissed"
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_player_status", ["playerId", "status"]),

  // Chat history for conversation context
  dotaChatHistory: defineTable({
    playerId: v.string(), // Clerk user ID
    role: v.string(), // "user" or "assistant"
    content: v.string(),
    timestamp: v.number(),
  }).index("by_player_time", ["playerId", "timestamp"]),
});
