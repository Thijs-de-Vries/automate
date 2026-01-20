/**
 * APARTMENT - Database operations for the Apartment mini-app
 *
 * This file contains all the "backend" functions for apartment item tracking.
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 *
 * Items are scoped to spaces (groups) and have an approval workflow.
 * Each function automatically syncs to all connected clients in real-time!
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
// HELPER: Get users who have commented on an item
// ============================================
async function getCommenters(ctx: any, itemId: any): Promise<string[]> {
  const comments = await ctx.db
    .query("apartment_comments")
    .withIndex("by_item", (q: any) => q.eq("itemId", itemId))
    .collect();

  const userIds = comments.map((c: any) => c.userId as string);
  const uniqueUserIds: string[] = Array.from(new Set(userIds));
  return uniqueUserIds;
}

// ============================================
// QUERY: List items for a space
// ============================================
export const list = query({
  args: {
    spaceId: v.id("spaces"),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("active"),
        v.literal("purchased")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    let query = ctx.db
      .query("apartment_items")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId));

    let items = await query.collect();

    // Filter by status
    if (args.status && args.status !== "all") {
      items = items.filter((item) => item.status === args.status);
    }

    // Sort by urgency (high first) then creation date (newest first)
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.createdAt - a.createdAt;
    });

    return items;
  },
});

// ============================================
// QUERY: Get single item by ID
// ============================================
export const getById = query({
  args: { id: v.id("apartment_items") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);
    return item;
  },
});

// ============================================
// QUERY: Get comments for an item
// ============================================
export const getComments = query({
  args: { itemId: v.id("apartment_items") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.itemId);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    const comments = await ctx.db
      .query("apartment_comments")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    return comments.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// ============================================
// QUERY: Get stats for home page
// ============================================
export const getStats = query({
  args: { spaceId: v.optional(v.id("spaces")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    if (!args.spaceId) return null;

    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const items = await ctx.db
      .query("apartment_items")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId!))
      .collect();

    const active = items.filter((i) => i.status === "active").length;
    const purchased = items.filter((i) => i.status === "purchased").length;
    const total = items.length;

    return {
      total,
      active,
      purchased,
    };
  },
});

// ============================================
// MUTATION: Submit a new item
// ============================================
export const submit = mutation({
  args: {
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
    urgency: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const itemId = await ctx.db.insert("apartment_items", {
      name: args.name,
      description: args.description,
      imageUrl: args.imageUrl,
      purchaseUrl: args.purchaseUrl,
      category: args.category,
      estimatedPrice: args.estimatedPrice,
      price: undefined,
      urgency: args.urgency,
      status: "active",
      submittedBy: identity.subject,
      submittedByName: identity.name ?? identity.email ?? undefined,
      spaceId: args.spaceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // No notification on submit (minimal notification strategy)

    return itemId;
  },
});

// ============================================
// MUTATION: Mark item as purchased
// ============================================
export const markAsPurchased = mutation({
  args: {
    id: v.id("apartment_items"),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    await ctx.db.patch(args.id, {
      status: "purchased",
      purchasedBy: identity.subject,
      purchasedByName: identity.name ?? identity.email ?? undefined,
      purchasedAt: Date.now(),
      price: args.price ?? item.estimatedPrice,
      updatedAt: Date.now(),
    });

    // Notify submitter only (if they have notifications enabled and aren't the purchaser)
    if (item.submittedBy !== identity.subject) {
      const submitterMembership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", item.spaceId).eq("userId", item.submittedBy)
        )
        .first();

      if (submitterMembership?.notificationPreferences?.apartment) {
        await ctx.scheduler.runAfter(0, internal.notificationsNode.sendPushToSpace, {
          spaceId: item.spaceId,
          module: "apartment",
          title: "Item Purchased",
          body: `${identity.name ?? "Someone"} purchased ${item.name}`,
          url: "/apartment",
          tag: `apartment-purchased-${args.id}`,
        });
      }
    }
  },
});

// ============================================
// MUTATION: Mark item as active (un-purchase)
// ============================================
export const markAsActive = mutation({
  args: { id: v.id("apartment_items") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    await ctx.db.patch(args.id, {
      status: "active",
      purchasedBy: undefined,
      purchasedByName: undefined,
      purchasedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

// ============================================
// MUTATION: Update item details
// ============================================
export const updateItem = mutation({
  args: {
    id: v.id("apartment_items"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    purchaseUrl: v.optional(v.string()),
    category: v.optional(
      v.union(
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
      )
    ),
    estimatedPrice: v.optional(v.number()),
    urgency: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    const updates: any = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.purchaseUrl !== undefined) updates.purchaseUrl = args.purchaseUrl;
    if (args.category !== undefined) updates.category = args.category;
    if (args.estimatedPrice !== undefined) updates.estimatedPrice = args.estimatedPrice;
    if (args.urgency !== undefined) updates.urgency = args.urgency;

    await ctx.db.patch(args.id, updates);
  },
});

// ============================================
// MUTATION: Delete an item
// ============================================
export const deleteItem = mutation({
  args: { id: v.id("apartment_items") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    // Only admins or the submitter can delete
    const membership = await requireSpaceAccess(ctx, item.spaceId, identity.subject);
    const isAdmin = membership.role === "creator" || membership.role === "admin";
    const isSubmitter = item.submittedBy === identity.subject;

    if (!isAdmin && !isSubmitter) {
      throw new Error("You can only delete items you submitted");
    }

    // Delete all comments first
    const comments = await ctx.db
      .query("apartment_comments")
      .withIndex("by_item", (q) => q.eq("itemId", args.id))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the item
    await ctx.db.delete(args.id);
  },
});

// ============================================
// MUTATION: Add a comment
// ============================================
export const addComment = mutation({
  args: {
    itemId: v.id("apartment_items"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.itemId);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    await ctx.db.insert("apartment_comments", {
      itemId: args.itemId,
      userId: identity.subject,
      userName: identity.name ?? identity.email ?? undefined,
      text: args.text,
      createdAt: Date.now(),
    });

    // Notify previous commenters only (minimal notification strategy)
    const commenters = await getCommenters(ctx, args.itemId);
    const notifyUserIds: string[] = commenters.filter((id) => id !== identity.subject);

    // Check each user's notification preferences
    for (const userId of notifyUserIds) {
      const membership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", item.spaceId).eq("userId", userId as string)
        )
        .first();

      if (membership?.notificationPreferences?.apartment) {
        await ctx.scheduler.runAfter(0, internal.notificationsNode.sendPushToSpace, {
          spaceId: item.spaceId,
          module: "apartment",
          title: "New Comment",
          body: `${identity.name ?? "Someone"} commented on "${item.name}"`,
          url: "/apartment",
          tag: `apartment-comment-${args.itemId}`,
        });
        // Only send one notification per comment event
        break;
      }
    }
  },
});

// ============================================
// MUTATION: Toggle reaction on a comment
// ============================================
export const toggleReaction = mutation({
  args: {
    commentId: v.id("apartment_comments"),
    emoji: v.union(
      v.literal("thumbsUp"),
      v.literal("heart"),
      v.literal("laugh"),
      v.literal("wow"),
      v.literal("sad"),
      v.literal("pray")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const comment = await ctx.db.get(args.commentId);

    if (!comment) {
      throw new Error("Comment not found");
    }

    const item = await ctx.db.get(comment.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    // Get current reactions or initialize
    const reactions = comment.reactions || {
      thumbsUp: [],
      heart: [],
      laugh: [],
      wow: [],
      sad: [],
      pray: [],
    };

    // Toggle the reaction
    const currentReactors = reactions[args.emoji] || [];
    const hasReacted = currentReactors.includes(identity.subject);

    if (hasReacted) {
      // Remove reaction
      reactions[args.emoji] = currentReactors.filter((id) => id !== identity.subject);
    } else {
      // Add reaction
      reactions[args.emoji] = [...currentReactors, identity.subject];
    }

    await ctx.db.patch(args.commentId, { reactions });
  },
});
