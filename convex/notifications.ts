/**
 * NOTIFICATIONS - Push notification management
 *
 * Handles storing push subscriptions.
 * The actual sending is done in notificationsNode.ts (Node.js runtime).
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
// QUERY: Get current user's subscription status
// ============================================
export const getSubscriptionStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isSubscribed: false, subscriptionCount: 0 };
    }

    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return {
      isSubscribed: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
    };
  },
});

// ============================================
// QUERY: Get VAPID public key for frontend
// ============================================
export const getVapidPublicKey = query({
  args: {},
  handler: async () => {
    // This will be set as an environment variable
    return process.env.VAPID_PUBLIC_KEY ?? null;
  },
});

// ============================================
// MUTATION: Save push subscription
// ============================================
export const saveSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Check if this endpoint already exists
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      // Update existing subscription (keys might have changed)
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
        userId: identity.subject,
        userAgent: args.userAgent,
      });
      return existing._id;
    }

    // Create new subscription
    return await ctx.db.insert("pushSubscriptions", {
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userId: identity.subject,
      userAgent: args.userAgent,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// MUTATION: Remove push subscription
// ============================================
export const removeSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (subscription && subscription.userId === identity.subject) {
      await ctx.db.delete(subscription._id);
    }
  },
});

// ============================================
// INTERNAL MUTATION: Remove stale subscription
// ============================================
export const removeStaleSubscription = internalMutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (subscription) {
      await ctx.db.delete(subscription._id);
      console.log(`Removed stale subscription: ${args.endpoint.substring(0, 50)}...`);
    }
  },
});

// ============================================
// INTERNAL QUERY: Get all subscriptions (for Node action)
// ============================================
export const getAllSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("pushSubscriptions").collect();
  },
});
