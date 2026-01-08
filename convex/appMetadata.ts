/**
 * App Metadata - for version tracking
 * 
 * Stores the current deployed version (Git commit SHA) in Convex.
 * Updated automatically when users load the app with a new version.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current app version stored in Convex
 */
export const getAppVersion = query({
  args: {},
  handler: async (ctx) => {
    const versionDoc = await ctx.db
      .query("appMetadata")
      .withIndex("by_key", (q) => q.eq("key", "app_version"))
      .first();
    
    return versionDoc?.value ?? null;
  },
});

/**
 * Set/update the app version in Convex
 * Called automatically when users load a new version
 */
export const setAppVersion = mutation({
  args: { version: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appMetadata")
      .withIndex("by_key", (q) => q.eq("key", "app_version"))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.version,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("appMetadata", {
        key: "app_version",
        value: args.version,
        updatedAt: Date.now(),
      });
    }
  },
});
