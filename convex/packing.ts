/**
 * PACKING - Database operations for the Packing List mini-app
 * 
 * This app has TWO tables:
 * - packing_trips: The trips (e.g., "Beach Vacation", "Business Trip")
 * - packing_items: Items in each trip (e.g., "Sunscreen", "Laptop")
 * 
 * Trips are scoped to spaces (groups). Each user sees trips from their active space.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// CATEGORIES for packing items
// ============================================
export const CATEGORIES = [
  "clothes",
  "toiletries", 
  "electronics",
  "documents",
  "other",
] as const;

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
// HELPER: Check user has access to space
// ============================================
async function requireSpaceAccess(ctx: any, spaceId: any, userId: string) {
  const membership = await ctx.db
    .query("space_members")
    .withIndex("by_space_and_user", (q: any) =>
      q.eq("spaceId", spaceId).eq("userId", userId)
    )
    .first();

  if (!membership) {
    throw new Error("You don't have access to this space");
  }
  return membership;
}

// ============================================
// GET STATS: For home page cards
// ============================================
export const getStats = query({
  args: {
    spaceId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    let trips;
    if (args.spaceId) {
      // Verify access
      const membership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", args.spaceId!).eq("userId", identity.subject)
        )
        .first();
      if (!membership) return null;

      trips = await ctx.db
        .query("packing_trips")
        .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
        .collect();
    } else {
      // Legacy: get all trips
      trips = await ctx.db.query("packing_trips").collect();
    }

    return {
      tripCount: trips.length,
    };
  },
});

// ============================================
// TRIPS - List, Create, Delete
// ============================================

/**
 * Get all trips for a space
 */
export const listTrips = query({
  args: {
    spaceId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    if (args.spaceId) {
      // Verify access
      const membership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", args.spaceId!).eq("userId", identity.subject)
        )
        .first();
      if (!membership) return [];

      return await ctx.db
        .query("packing_trips")
        .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
        .order("desc")
        .collect();
    }

    // No spaceId provided - return empty array
    return [];
  },
});

/**
 * Create a new trip
 */
export const createTrip = mutation({
  args: { 
    name: v.string(),
    spaceId: v.optional(v.id("spaces")),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    if (args.spaceId) {
      await requireSpaceAccess(ctx, args.spaceId, identity.subject);
    }

    const tripId = await ctx.db.insert("packing_trips", {
      name: args.name,
      createdAt: Date.now(),
      userId: identity.subject,
      spaceId: args.spaceId,
    });

    return tripId;
  },
});

/**
 * Delete a trip and all its items
 */
export const deleteTrip = mutation({
  args: { 
    id: v.id("packing_trips"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const trip = await ctx.db.get(args.id);
    if (!trip) {
      throw new Error("Trip not found");
    }

    // Verify space access if trip has a space
    if (trip.spaceId) {
      await requireSpaceAccess(ctx, trip.spaceId, identity.subject);
    }

    // Delete all items in this trip first
    const items = await ctx.db
      .query("packing_items")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Then delete the trip itself
    await ctx.db.delete(args.id);
  },
});

// ============================================
// ITEMS - List, Add, Toggle, Remove
// ============================================

/**
 * Get all items for a specific trip
 */
export const listItems = query({
  args: { 
    tripId: v.id("packing_trips"),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      return [];
    }

    // Verify space access if trip has a space
    if (trip.spaceId) {
      const membership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", trip.spaceId!).eq("userId", identity.subject)
        )
        .first();
      if (!membership) return [];
    }

    const items = await ctx.db
      .query("packing_items")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    return items;
  },
});

/**
 * Add a new item to a trip
 */
export const addItem = mutation({
  args: {
    tripId: v.id("packing_trips"),
    text: v.string(),
    category: v.string(),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    // Verify space access if trip has a space
    if (trip.spaceId) {
      await requireSpaceAccess(ctx, trip.spaceId, identity.subject);
    }

    const itemId = await ctx.db.insert("packing_items", {
      tripId: args.tripId,
      text: args.text,
      category: args.category,
      isPacked: false,
      createdAt: Date.now(),
    });

    return itemId;
  },
});

/**
 * Toggle an item as packed/unpacked
 */
export const toggleItem = mutation({
  args: { 
    id: v.id("packing_items"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    const trip = await ctx.db.get(item.tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    // Verify space access if trip has a space
    if (trip.spaceId) {
      await requireSpaceAccess(ctx, trip.spaceId, identity.subject);
    }

    await ctx.db.patch(args.id, { 
      isPacked: !item.isPacked 
    });
  },
});

/**
 * Remove an item from a trip
 */
export const removeItem = mutation({
  args: { 
    id: v.id("packing_items"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    const trip = await ctx.db.get(item.tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    // Verify space access if trip has a space
    if (trip.spaceId) {
      await requireSpaceAccess(ctx, trip.spaceId, identity.subject);
    }

    await ctx.db.delete(args.id);
  },
});
