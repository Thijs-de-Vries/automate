/**
 * PACKING - Database operations for the Packing List mini-app
 * 
 * This app has TWO tables:
 * - packing_trips: The trips (e.g., "Beach Vacation", "Business Trip")
 * - packing_items: Items in each trip (e.g., "Sunscreen", "Laptop")
 * 
 * All data is shared between users - no per-user filtering.
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
// GET STATS: For home page cards
// ============================================
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const trips = await ctx.db.query("packing_trips").collect();
    return {
      tripCount: trips.length,
    };
  },
});

// ============================================
// TRIPS - List, Create, Delete
// ============================================

/**
 * Get all trips
 */
export const listTrips = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const trips = await ctx.db
      .query("packing_trips")
      .order("desc")
      .collect();

    return trips;
  },
});

/**
 * Create a new trip
 */
export const createTrip = mutation({
  args: { 
    name: v.string(),
  },

  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const tripId = await ctx.db.insert("packing_trips", {
      name: args.name,
      createdAt: Date.now(),
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
    await requireAuth(ctx);

    const trip = await ctx.db.get(args.id);
    if (!trip) {
      throw new Error("Trip not found");
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
    await requireAuth(ctx);

    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      throw new Error("Trip not found");
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
    await requireAuth(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
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
    await requireAuth(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    await ctx.db.delete(args.id);
  },
});
