/**
 * TASKS - Database operations for the Tasks mini-app
 * 
 * This file contains all the "backend" functions for tasks.
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 * 
 * Each function automatically syncs to all connected clients in real-time!
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// HELPER: Get the current logged-in user
// ============================================
async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return {
    id: identity.subject,        // Unique user ID from Clerk
    email: identity.email,       // User's email
    name: identity.name,         // User's name
  };
}

// ============================================
// LIST: Get all tasks for the current user
// ============================================
export const list = query({
  // No arguments needed - we get the user from auth
  args: {},
  
  handler: async (ctx) => {
    // Step 1: Check if user is logged in
    const user = await getCurrentUser(ctx);
    if (!user) {
      // Not logged in = return empty list
      return [];
    }

    // Step 2: Query the database for this user's tasks
    // - "tasks" is the table name
    // - withIndex uses our "by_user" index for fast lookups
    // - order("desc") shows newest first
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .order("desc")
      .collect();

    return tasks;
  },
});

// ============================================
// CREATE: Add a new task
// ============================================
export const create = mutation({
  // Define what data this function expects
  args: { 
    text: v.string(),  // The task text, must be a string
  },

  handler: async (ctx, args) => {
    // Step 1: Check if user is logged in
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in to create a task");
    }

    // Step 2: Insert the new task into the database
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,           // The task text from the form
      isCompleted: false,        // New tasks start as not completed
      userId: user.id,           // Link to the user who created it
      createdAt: Date.now(),     // Timestamp for sorting
    });

    // Return the new task's ID
    return taskId;
  },
});

// ============================================
// TOGGLE: Mark a task as done/not done
// ============================================
export const toggle = mutation({
  args: { 
    id: v.id("tasks"),  // The task ID to toggle
  },

  handler: async (ctx, args) => {
    // Step 1: Check if user is logged in
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in");
    }

    // Step 2: Get the task from the database
    const task = await ctx.db.get(args.id);
    
    // Step 3: Security check - make sure the task exists and belongs to this user
    if (!task) {
      throw new Error("Task not found");
    }
    if (task.userId !== user.id) {
      throw new Error("This is not your task");
    }

    // Step 4: Update the task - flip isCompleted from true->false or false->true
    await ctx.db.patch(args.id, { 
      isCompleted: !task.isCompleted 
    });
  },
});

// ============================================
// REMOVE: Delete a task
// ============================================
export const remove = mutation({
  args: { 
    id: v.id("tasks"),  // The task ID to delete
  },

  handler: async (ctx, args) => {
    // Step 1: Check if user is logged in
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be logged in");
    }

    // Step 2: Get the task from the database
    const task = await ctx.db.get(args.id);
    
    // Step 3: Security check
    if (!task) {
      throw new Error("Task not found");
    }
    if (task.userId !== user.id) {
      throw new Error("This is not your task");
    }

    // Step 4: Delete the task
    await ctx.db.delete(args.id);
  },
});
