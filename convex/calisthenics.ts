/**
 * EXERCISES - Database operations for the Exercises mini-app
 * 
 * This file contains all the "backend" functions for exercises.
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 * 
 * All data is shared between users - no per-user filtering.
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
// LIST: Get all exercises
// ============================================
export const list = query({
  args: {},
  
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const exercises = await ctx.db
      .query("calisthenics")
      .order("desc")
      .collect();

    return exercises;
  },
});

// ============================================
// CREATE: Add a new exercise
// ============================================
export const create = mutation({
  args: { 
    exercise: v.string(),
    reps: v.number(),
  },

  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const exerciseId = await ctx.db.insert("calisthenics", {
      exercise: args.exercise,
      reps: args.reps,
      isCompleted: false,
      createdAt: Date.now(),
      userId: identity.subject,
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
    await requireAuth(ctx);

    const exercise = await ctx.db.get(args.id);
    if (!exercise) {
      throw new Error("Exercise not found");
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
    await requireAuth(ctx);

    const exercise = await ctx.db.get(args.id);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    await ctx.db.delete(args.id);
  },
});
