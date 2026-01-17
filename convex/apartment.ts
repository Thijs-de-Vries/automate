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
// HELPER: Check if user is admin or creator
// ============================================
async function requireAdminAccess(ctx: any, spaceId: any, userId: string) {
  const membership = await requireSpaceAccess(ctx, spaceId, userId);
  
  if (membership.role !== "creator" && membership.role !== "admin") {
    throw new Error("You must be an admin or creator to perform this action");
  }
  
  return membership;
}

// ============================================
// HELPER: Get admins/creators with notifications enabled
// ============================================
async function getAdminsWithNotifications(ctx: any, spaceId: any) {
  const members = await ctx.db
    .query("space_members")
    .withIndex("by_space", (q: any) => q.eq("spaceId", spaceId))
    .collect();

  return members.filter(
    (m: any) =>
      (m.role === "creator" || m.role === "admin") &&
      m.notificationPreferences?.apartment === true
  );
}

// ============================================
// HELPER: Get users who have commented on an item
// ============================================
async function getCommenters(ctx: any, itemId: any) {
  const comments = await ctx.db
    .query("apartment_comments")
    .withIndex("by_item", (q: any) => q.eq("itemId", itemId))
    .collect();

  const uniqueUserIds = [...new Set(comments.map((c: any) => c.userId))];
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
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("ordered"),
        v.literal("delivered")
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
    } else if (!args.status || args.status === "all") {
      // "All" excludes rejected items
      items = items.filter((item) => item.status !== "rejected");
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

    const pending = items.filter((i) => i.status === "pending").length;
    const approved = items.filter((i) => i.status === "approved").length;
    const ordered = items.filter((i) => i.status === "ordered").length;
    const total = items.filter((i) => i.status !== "rejected").length;

    return {
      total,
      pending,
      approved,
      ordered,
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
      actualPrice: undefined,
      urgency: args.urgency,
      status: "pending",
      submittedBy: identity.subject,
      submittedByName: identity.name ?? identity.email ?? undefined,
      spaceId: args.spaceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Notify admins/creators with apartment notifications enabled
    const admins = await getAdminsWithNotifications(ctx, args.spaceId);
    
    if (admins.length > 0) {
      await ctx.scheduler.runAfter(0, internal.notificationsNode.sendPushToSpace, {
        spaceId: args.spaceId,
        module: "apartment",
        title: "New Apartment Item Suggestion",
        body: `${identity.name ?? "Someone"} suggested: ${args.name}`,
        url: "/apartment",
        tag: `apartment-new-${itemId}`,
      });
    }

    return itemId;
  },
});

// ============================================
// MUTATION: Approve an item
// ============================================
export const approve = mutation({
  args: { id: v.id("apartment_items") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireAdminAccess(ctx, item.spaceId, identity.subject);

    await ctx.db.patch(args.id, {
      status: "approved",
      approvedBy: identity.subject,
      approvedByName: identity.name ?? identity.email ?? undefined,
      updatedAt: Date.now(),
    });

    // Notify submitter only (if they have notifications enabled)
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
        title: "Item Approved!",
        body: `Your suggestion "${item.name}" was approved`,
        url: "/apartment",
        tag: `apartment-approved-${args.id}`,
      });
    }
  },
});

// ============================================
// MUTATION: Reject an item
// ============================================
export const reject = mutation({
  args: {
    id: v.id("apartment_items"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireAdminAccess(ctx, item.spaceId, identity.subject);

    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectedBy: identity.subject,
      rejectedByName: identity.name ?? identity.email ?? undefined,
      rejectionReason: args.reason,
      updatedAt: Date.now(),
    });

    // Notify submitter only (if they have notifications enabled)
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
        title: "Item Not Approved",
        body: `Your suggestion "${item.name}" was not approved: ${args.reason}`,
        url: "/apartment",
        tag: `apartment-rejected-${args.id}`,
      });
    }
  },
});

// ============================================
// MUTATION: Update item status
// ============================================
export const updateStatus = mutation({
  args: {
    id: v.id("apartment_items"),
    status: v.union(
      v.literal("approved"),
      v.literal("ordered"),
      v.literal("delivered")
    ),
    actualPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Item not found");
    }

    await requireSpaceAccess(ctx, item.spaceId, identity.subject);

    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "ordered") {
      updates.orderedDate = Date.now();
    } else if (args.status === "delivered") {
      updates.deliveredDate = Date.now();
    }

    if (args.actualPrice !== undefined) {
      updates.actualPrice = args.actualPrice;
    }

    await ctx.db.patch(args.id, updates);
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

    // Notify: submitter + admins/creators + all previous commenters
    const submitterId = item.submittedBy;
    const admins = await getAdminsWithNotifications(ctx, item.spaceId);
    const adminIds = admins.map((a: any) => a.userId);
    const commenters = await getCommenters(ctx, args.itemId);

    // Combine and dedupe, exclude current user
    const notifyUserIds = [
      submitterId,
      ...adminIds,
      ...commenters,
    ].filter((id, index, self) => 
      id !== identity.subject && self.indexOf(id) === index
    );

    // Check each user's notification preferences
    for (const userId of notifyUserIds) {
      const membership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", item.spaceId).eq("userId", userId)
        )
        .first();

      if (membership?.notificationPreferences?.apartment) {
        await ctx.scheduler.runAfter(0, internal.notificationsNode.sendPushToSpace, {
          spaceId: item.spaceId,
          module: "apartment",
          title: "New Comment",
          body: `${identity.name ?? "Someone"} commented on "${item.name}"`,
          url: "/apartment",
          tag: `apartment-comment-${args.itemId}-${Date.now()}`,
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
