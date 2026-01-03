/**
 * TASKS - Database operations for the Tasks mini-app
 * 
 * This file contains all the "backend" functions for tasks.
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 * 
 * All data is shared between users - no per-user filtering.
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
// GET STATS: For home page cards
// ============================================
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const tasks = await ctx.db.query("tasks").collect();
    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.isCompleted).length,
    };
  },
});

// ============================================
// LIST: Get all tasks
// ============================================
export const list = query({
  args: {},
  
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const tasks = await ctx.db
      .query("tasks")
      .order("desc")
      .collect();

    return tasks;
  },
});

// ============================================
// CREATE: Add a new task
// ============================================
export const create = mutation({
  args: { 
    text: v.string(),
  },

  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      createdAt: Date.now(),
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
    await requireAuth(ctx);

    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    const wasCompleted = task.isCompleted;
    const nowCompleted = !wasCompleted;

    await ctx.db.patch(args.id, { 
      isCompleted: nowCompleted 
    });

    // Send push notification when task is completed
    if (!wasCompleted && nowCompleted) {
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
    await requireAuth(ctx);

    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    await ctx.db.delete(args.id);
  },
});
