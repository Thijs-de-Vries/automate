import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tasks app tables - shared by all users
  // userId is optional for backwards compatibility with existing data
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
    userId: v.optional(v.string()),
  }),

  // Packing app tables - shared by all users
  // userId is optional for backwards compatibility with existing data
  packing_trips: defineTable({
    name: v.string(),
    createdAt: v.number(),
    userId: v.optional(v.string()),
  }),

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
    name: v.string(), // e.g., "Commute to Utrecht"
    originCode: v.string(), // Station code, e.g., "GVC"
    originName: v.string(), // Display name, e.g., "Den Haag Centraal"
    destinationCode: v.string(),
    destinationName: v.string(),
    scheduleDays: v.array(v.number()), // 0-6 (Sun-Sat)
    departureTime: v.string(), // "HH:MM" format
    urgencyLevel: v.union(v.literal("normal"), v.literal("important")),
    createdAt: v.number(),
    // TODO: Add one-off date support in future
    // oneOffDate: v.optional(v.string()), // "YYYY-MM-DD" for single trips
  }),

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

  // Tasks app tables - per user
  calisthenics: defineTable({
    exercise: v.string(),
    reps: v.number(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
    userId: v.string(),
  }),
});
