/**
 * TASKS - Database operations for the Tasks mini-app
 * 
 * This file contains all the "backend" functions for tasks.
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 * 
 * Tasks are scoped to spaces (groups). Each user sees tasks from their active space.
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
// FAVORITES: User's pinned automations
// ============================================
export const getFavorites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return prefs?.favoriteAutomations ?? [];
  },
});

export const toggleFavorite = mutation({
  args: {
    automationId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!prefs) {
      // Create preferences with this automation as favorite
      await ctx.db.insert("userPreferences", {
        clerkId: identity.subject,
        favoriteAutomations: [args.automationId],
        updatedAt: Date.now(),
      });
    } else {
      const favorites = prefs.favoriteAutomations;
      const index = favorites.indexOf(args.automationId);

      if (index === -1) {
        // Add to favorites
        await ctx.db.patch(prefs._id, {
          favoriteAutomations: [...favorites, args.automationId],
          updatedAt: Date.now(),
        });
      } else {
        // Remove from favorites
        await ctx.db.patch(prefs._id, {
          favoriteAutomations: favorites.filter((id) => id !== args.automationId),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const reorderFavorites = mutation({
  args: {
    favoriteIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (prefs) {
      await ctx.db.patch(prefs._id, {
        favoriteAutomations: args.favoriteIds,
        updatedAt: Date.now(),
      });
    }
  },
});

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

    let tasks;
    if (args.spaceId) {
      // Verify access
      const membership = await ctx.db
        .query("space_members")
        .withIndex("by_space_and_user", (q) =>
          q.eq("spaceId", args.spaceId!).eq("userId", identity.subject)
        )
        .first();
      if (!membership) return null;

      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
        .collect();
    } else {
      // Legacy: get all tasks (for migration period)
      tasks = await ctx.db.query("tasks").collect();
    }

    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.isCompleted).length,
    };
  },
});

// ============================================
// LIST: Get all tasks for a space
// ============================================
export const list = query({
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
        .query("tasks")
        .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
        .order("desc")
        .collect();
    }

    // No spaceId provided - return empty array
    return [];
  },
});

// ============================================
// CREATE: Add a new task
// ============================================
export const create = mutation({
  args: { 
    text: v.string(),
    spaceId: v.optional(v.id("spaces")),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    if (args.spaceId) {
      await requireSpaceAccess(ctx, args.spaceId, identity.subject);
    }

    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      createdAt: Date.now(),
      userId: identity.subject,
      spaceId: args.spaceId,
    });

    return taskId;
  },
});

// ============================================
// TOGGLE: Mark a task as done/not done
// ============================================
export const toggle = mutation({
  args: { 
    id: v.id("tasks"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    // Verify space access if task has a space
    if (task.spaceId) {
      await requireSpaceAccess(ctx, task.spaceId, identity.subject);
    }

    const wasCompleted = task.isCompleted;
    const nowCompleted = !wasCompleted;

    await ctx.db.patch(args.id, { 
      isCompleted: nowCompleted 
    });

    // Send push notification when task is completed
    if (!wasCompleted && nowCompleted && task.spaceId) {
      // Use space-scoped notifications (respects opt-in)
      await ctx.scheduler.runAfter(0, internal.notificationsNode.sendPushToSpace, {
        spaceId: task.spaceId,
        module: "tasks",
        title: "Task completed ✓",
        body: task.text,
        url: "/tasks",
        tag: `task-${args.id}`,
      });
    } else if (!wasCompleted && nowCompleted) {
      // Legacy: send to all (for tasks without space)
      await ctx.scheduler.runAfter(0, internal.notificationsNode.sendPushToAll, {
        title: "Task completed ✓",
        body: task.text,
        url: "/tasks",
        tag: `task-${args.id}`,
      });
    }
  },
});

// ============================================
// REMOVE: Delete a task
// ============================================
export const remove = mutation({
  args: { 
    id: v.id("tasks"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    // Verify space access if task has a space
    if (task.spaceId) {
      await requireSpaceAccess(ctx, task.spaceId, identity.subject);
    }

    await ctx.db.delete(args.id);
  },
});
