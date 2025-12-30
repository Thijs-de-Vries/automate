/**
 * PUBLIC TRANSPORT - Database operations for the Public Transport Disruptions mini-app
 *
 * This app has FIVE tables:
 * - pt_stations: Cached stations from NS API
 * - pt_routes: User-defined routes to monitor
 * - pt_route_stations: Stations on each route (origin, intermediate, destination)
 * - pt_disruptions: Cached disruptions per route
 * - pt_route_status: Status tracking for badges
 *
 * All data is shared between users - no per-user filtering.
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// HELPER: Check if user is authenticated
// ============================================
async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("You must be logged in");
  }
  return identity;
}

// ============================================
// GET STATS: For home page cards
// ============================================
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const routes = await ctx.db.query("pt_routes").collect();
    
    // Count active disruptions across all routes
    let activeDisruptionCount = 0;
    let routesWithDisruptions = 0;
    
    for (const route of routes) {
      const disruptions = await ctx.db
        .query("pt_disruptions")
        .withIndex("by_route_active", (q) => 
          q.eq("routeId", route._id).eq("isActive", true)
        )
        .collect();
      
      if (disruptions.length > 0) {
        routesWithDisruptions++;
        activeDisruptionCount += disruptions.length;
      }
    }

    return {
      routeCount: routes.length,
      activeDisruptionCount,
      routesWithDisruptions,
    };
  },
});

// ============================================
// STATIONS - Search cached stations
// ============================================

/**
 * Search stations by name or code
 */
export const searchStations = query({
  args: { 
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const searchTerm = args.query.toLowerCase().trim();
    if (searchTerm.length < 2) {
      return [];
    }

    // Get all stations and filter client-side (Convex doesn't have LIKE queries)
    const allStations = await ctx.db.query("pt_stations").collect();
    
    const matches = allStations.filter((station) => {
      return (
        station.code.toLowerCase().includes(searchTerm) ||
        station.nameLong.toLowerCase().includes(searchTerm) ||
        station.nameMedium.toLowerCase().includes(searchTerm) ||
        station.nameShort.toLowerCase().includes(searchTerm) ||
        station.synonyms.some((s) => s.toLowerCase().includes(searchTerm))
      );
    });

    // Return top 10 matches, sorted by relevance (exact code match first)
    return matches
      .sort((a, b) => {
        // Exact code match first
        if (a.code.toLowerCase() === searchTerm) return -1;
        if (b.code.toLowerCase() === searchTerm) return 1;
        // Then by name length (shorter = more relevant)
        return a.nameLong.length - b.nameLong.length;
      })
      .slice(0, 10);
  },
});

/**
 * Get a station by its code
 */
export const getStationByCode = query({
  args: { 
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const station = await ctx.db
      .query("pt_stations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    
    return station;
  },
});

/**
 * Get count of cached stations
 */
export const getStationCount = query({
  args: {},
  handler: async (ctx) => {
    const stations = await ctx.db.query("pt_stations").collect();
    return stations.length;
  },
});

// ============================================
// ROUTES - List, Create, Update, Delete
// ============================================

/**
 * Get all routes with their status
 */
export const listRoutes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const routes = await ctx.db
      .query("pt_routes")
      .order("desc")
      .collect();

    // Join with status and disruption counts
    const routesWithStatus = await Promise.all(
      routes.map(async (route) => {
        const status = await ctx.db
          .query("pt_route_status")
          .withIndex("by_route", (q) => q.eq("routeId", route._id))
          .first();

        const activeDisruptions = await ctx.db
          .query("pt_disruptions")
          .withIndex("by_route_active", (q) => 
            q.eq("routeId", route._id).eq("isActive", true)
          )
          .collect();

        return {
          ...route,
          status: status ?? {
            lastCheckedAt: null,
            hasActiveDisruptions: false,
            changedSinceLastView: false,
          },
          activeDisruptionCount: activeDisruptions.length,
        };
      })
    );

    return routesWithStatus;
  },
});

/**
 * Get a single route with details
 */
export const getRoute = query({
  args: { 
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const route = await ctx.db.get(args.routeId);
    if (!route) return null;

    const status = await ctx.db
      .query("pt_route_status")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .first();

    const stations = await ctx.db
      .query("pt_route_stations")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .collect();

    return {
      ...route,
      status,
      stations: stations.sort((a, b) => a.order - b.order),
    };
  },
});

/**
 * Create a new route
 */
export const createRoute = mutation({
  args: {
    name: v.string(),
    originCode: v.string(),
    originName: v.string(),
    destinationCode: v.string(),
    destinationName: v.string(),
    scheduleDays: v.array(v.number()),
    departureTime: v.string(),
    urgencyLevel: v.union(v.literal("normal"), v.literal("important")),
    // Optional: pre-computed stations from route selection
    stations: v.optional(v.array(v.object({
      code: v.string(),
      name: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const routeId = await ctx.db.insert("pt_routes", {
      name: args.name,
      originCode: args.originCode,
      originName: args.originName,
      destinationCode: args.destinationCode,
      destinationName: args.destinationName,
      scheduleDays: args.scheduleDays,
      departureTime: args.departureTime,
      urgencyLevel: args.urgencyLevel,
      createdAt: Date.now(),
    });

    // If stations were provided (from route selection), use those
    if (args.stations && args.stations.length >= 2) {
      for (let i = 0; i < args.stations.length; i++) {
        await ctx.db.insert("pt_route_stations", {
          routeId,
          stationCode: args.stations[i].code,
          stationName: args.stations[i].name,
          order: i,
        });
      }
    } else {
      // Fallback: just origin and destination
      await ctx.db.insert("pt_route_stations", {
        routeId,
        stationCode: args.originCode,
        stationName: args.originName,
        order: 0,
      });

      await ctx.db.insert("pt_route_stations", {
        routeId,
        stationCode: args.destinationCode,
        stationName: args.destinationName,
        order: 1,
      });
    }

    // Initialize route status
    await ctx.db.insert("pt_route_status", {
      routeId,
      lastCheckedAt: 0,
      hasActiveDisruptions: false,
      changedSinceLastView: false,
    });

    return routeId;
  },
});

/**
 * Update an existing route
 */
export const updateRoute = mutation({
  args: {
    routeId: v.id("pt_routes"),
    name: v.optional(v.string()),
    scheduleDays: v.optional(v.array(v.number())),
    departureTime: v.optional(v.string()),
    urgencyLevel: v.optional(v.union(v.literal("normal"), v.literal("important"))),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const route = await ctx.db.get(args.routeId);
    if (!route) {
      throw new Error("Route not found");
    }

    const updates: Record<string, any> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.scheduleDays !== undefined) updates.scheduleDays = args.scheduleDays;
    if (args.departureTime !== undefined) updates.departureTime = args.departureTime;
    if (args.urgencyLevel !== undefined) updates.urgencyLevel = args.urgencyLevel;

    await ctx.db.patch(args.routeId, updates);
  },
});

/**
 * Delete a route and all related data
 */
export const deleteRoute = mutation({
  args: { 
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const route = await ctx.db.get(args.routeId);
    if (!route) {
      throw new Error("Route not found");
    }

    // Delete route stations
    const stations = await ctx.db
      .query("pt_route_stations")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .collect();
    for (const station of stations) {
      await ctx.db.delete(station._id);
    }

    // Delete disruptions
    const disruptions = await ctx.db
      .query("pt_disruptions")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .collect();
    for (const disruption of disruptions) {
      await ctx.db.delete(disruption._id);
    }

    // Delete status
    const status = await ctx.db
      .query("pt_route_status")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .first();
    if (status) {
      await ctx.db.delete(status._id);
    }

    // Delete the route itself
    await ctx.db.delete(args.routeId);
  },
});

// ============================================
// DISRUPTIONS - Get disruptions for a route
// ============================================

/**
 * Get disruptions for a route (active or old)
 */
export const getRouteDisruptions = query({
  args: { 
    routeId: v.id("pt_routes"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const disruptions = await ctx.db
      .query("pt_disruptions")
      .withIndex("by_route_active", (q) => 
        q.eq("routeId", args.routeId).eq("isActive", args.isActive)
      )
      .collect();

    // Sort by lastSeen (most recent first)
    return disruptions.sort((a, b) => b.lastSeen - a.lastSeen);
  },
});

/**
 * Mark a route as viewed (clear changed badge)
 */
export const markRouteViewed = mutation({
  args: { 
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const status = await ctx.db
      .query("pt_route_status")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .first();

    if (status) {
      await ctx.db.patch(status._id, {
        changedSinceLastView: false,
      });
    }
  },
});

// ============================================
// INTERNAL QUERIES - For use by actions/crons
// ============================================

/**
 * Get route with stations (internal, no auth check)
 */
export const getRouteInternal = internalQuery({
  args: {
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    const route = await ctx.db.get(args.routeId);
    if (!route) return null;

    const stations = await ctx.db
      .query("pt_route_stations")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .collect();

    return {
      ...route,
      stations: stations.sort((a, b) => a.order - b.order),
    };
  },
});

/**
 * Get all routes that should be checked today (internal)
 */
export const getRoutesForToday = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    
    const allRoutes = await ctx.db.query("pt_routes").collect();
    
    return allRoutes.filter((route) => route.scheduleDays.includes(today));
  },
});

/**
 * Get a station by its UIC code (internal - for mapping trip API responses)
 */
export const getStationByUicCode = internalQuery({
  args: { uicCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pt_stations")
      .withIndex("by_uic_code", (q) => q.eq("uicCode", args.uicCode))
      .first();
  },
});

// ============================================
// INTERNAL MUTATIONS - For use by actions/crons
// ============================================

/**
 * Upsert a station (used by station sync action)
 */
export const upsertStation = internalMutation({
  args: {
    code: v.string(),
    uicCode: v.string(),
    nameLong: v.string(),
    nameMedium: v.string(),
    nameShort: v.string(),
    synonyms: v.array(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pt_stations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("pt_stations", args);
    }
  },
});

/**
 * Upsert a disruption (used by disruption check action)
 */
export const upsertDisruption = internalMutation({
  args: {
    routeId: v.id("pt_routes"),
    disruptionId: v.string(),
    type: v.string(),
    title: v.string(),
    description: v.string(),
    period: v.string(),
    advice: v.optional(v.string()),
    affectedStations: v.array(v.string()),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Find existing disruption by routeId + disruptionId
    const existing = await ctx.db
      .query("pt_disruptions")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .filter((q) => q.eq(q.field("disruptionId"), args.disruptionId))
      .first();

    const now = Date.now();
    let hasChanged = false;

    if (existing) {
      // Check if content changed
      if (existing.contentHash !== args.contentHash) {
        hasChanged = true;
      }
      await ctx.db.patch(existing._id, {
        ...args,
        lastSeen: now,
        isActive: true,
      });
    } else {
      // New disruption
      hasChanged = true;
      await ctx.db.insert("pt_disruptions", {
        ...args,
        lastSeen: now,
        isActive: true,
      });
    }

    // Update route status if changed
    if (hasChanged) {
      const status = await ctx.db
        .query("pt_route_status")
        .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
        .first();

      if (status) {
        await ctx.db.patch(status._id, {
          changedSinceLastView: true,
          hasActiveDisruptions: true,
          lastCheckedAt: now,
        });
      }
    }
  },
});

/**
 * Mark old disruptions as inactive (used by disruption check action)
 */
export const markOldDisruptionsInactive = internalMutation({
  args: {
    routeId: v.id("pt_routes"),
    activeDisruptionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const allDisruptions = await ctx.db
      .query("pt_disruptions")
      .withIndex("by_route_active", (q) => 
        q.eq("routeId", args.routeId).eq("isActive", true)
      )
      .collect();

    let changed = false;

    for (const disruption of allDisruptions) {
      if (!args.activeDisruptionIds.includes(disruption.disruptionId)) {
        await ctx.db.patch(disruption._id, { isActive: false });
        changed = true;
      }
    }

    // Update status
    const activeCount = args.activeDisruptionIds.length;
    const status = await ctx.db
      .query("pt_route_status")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .first();

    if (status) {
      await ctx.db.patch(status._id, {
        hasActiveDisruptions: activeCount > 0,
        lastCheckedAt: Date.now(),
        ...(changed ? { changedSinceLastView: true } : {}),
      });
    }
  },
});

/**
 * Update route status after check (used by disruption check action)
 */
export const updateRouteStatus = internalMutation({
  args: {
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query("pt_route_status")
      .withIndex("by_route", (q) => q.eq("routeId", args.routeId))
      .first();

    if (status) {
      await ctx.db.patch(status._id, {
        lastCheckedAt: Date.now(),
      });
    }
  },
});
