/**
 * PACKING - Database operations for the Packing List mini-app
 * 
 * This app has TWO tables:
 * - packing_trips: The trips (e.g., "Beach Vacation", "Business Trip")
 * - packing_items: Items in each trip (e.g., "Sunscreen", "Laptop")
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
// HELPER: Get the current logged-in user
// ============================================
async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return {
    id: identity.subject,
    email: identity.email,
    name: identity.name,
  };
}

// ============================================
// TRIPS - List, Create, Delete
// ============================================

/**
 * Get all trips for the current user
 */
export const listTrips = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const trips = await ctx.db
      .query("packing_trips")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
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
    name: v.string(),  // e.g., "Hawaii Vacation"
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in to create a trip");
    }

    const tripId = await ctx.db.insert("packing_trips", {
      name: args.name,
      userId: user.id,
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
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in");
    }

    // Get the trip
    const trip = await ctx.db.get(args.id);
    if (!trip || trip.userId !== user.id) {
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
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    // First verify the trip belongs to this user
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user.id) {
      return [];
    }

    // Get all items for this trip
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
    text: v.string(),      // e.g., "Sunscreen"
    category: v.string(),  // e.g., "toiletries"
  },

  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in");
    }

    // Verify trip ownership
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user.id) {
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
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in");
    }

    // Get the item
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Verify the item's trip belongs to this user
    const trip = await ctx.db.get(item.tripId);
    if (!trip || trip.userId !== user.id) {
      throw new Error("Not authorized");
    }

    // Toggle the packed status
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
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in");
    }

    // Get the item
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Verify the item's trip belongs to this user
    const trip = await ctx.db.get(item.tripId);
    if (!trip || trip.userId !== user.id) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.id);
  },
});
