/**
 * EXERCISES - Database operations for the Exercises mini-app
 * 
 * This file contains all the "backend" functions for exercises.
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 * 
 * Exercises are scoped to spaces (groups) and users.
 * Each function automatically syncs to all connected clients in real-time!
 */

import { query, mutation } from "./_generated/server";
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
// export const getStats = query({
//   args: {},
//   handler: async (ctx) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) {
//       return null;
//     }

//     const exercises = await ctx.db.query("calisthenics").collect();
//     return {
//       total: exercises.length,
//       completed: exercises.filter((t) => t.isCompleted).length,
//     };
//   },
// });

// ============================================
// LIST: Get all exercises for a space
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

      // Get exercises for this space (from all users in space)
      return await ctx.db
        .query("calisthenics")
        .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
        .order("desc")
        .collect();
    }

    // No spaceId provided - return empty array
    return [];
  },
});

// ============================================
// CREATE: Add a new exercise
// ============================================
export const create = mutation({
  args: { 
    exercise: v.string(),
    reps: v.number(),
    spaceId: v.optional(v.id("spaces")),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    if (args.spaceId) {
      await requireSpaceAccess(ctx, args.spaceId, identity.subject);
    }

    const exerciseId = await ctx.db.insert("calisthenics", {
      exercise: args.exercise,
      reps: args.reps,
      isCompleted: false,
      createdAt: Date.now(),
      userId: identity.subject,
      spaceId: args.spaceId,
    });

    return exerciseId;
  },
});

// ============================================
// TOGGLE: Mark an exercise as done/not done
// ============================================
export const toggle = mutation({
  args: { 
    id: v.id("calisthenics"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const exercise = await ctx.db.get(args.id);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    // Verify space access if exercise has a space
    if (exercise.spaceId) {
      await requireSpaceAccess(ctx, exercise.spaceId, identity.subject);
    } else if (exercise.userId !== identity.subject) {
      throw new Error("You can only toggle your own exercises");
    }

    const wasCompleted = exercise.isCompleted;
    const nowCompleted = !wasCompleted;

    await ctx.db.patch(args.id, { 
      isCompleted: nowCompleted 
    });
  },
});

// ============================================
// REMOVE: Delete an exercise
// ============================================
export const remove = mutation({
  args: { 
    id: v.id("calisthenics"),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const exercise = await ctx.db.get(args.id);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    // Verify space access if exercise has a space
    if (exercise.spaceId) {
      await requireSpaceAccess(ctx, exercise.spaceId, identity.subject);
    } else if (exercise.userId !== identity.subject) {
      throw new Error("You can only delete your own exercises");
    }

    await ctx.db.delete(args.id);
  },
});
