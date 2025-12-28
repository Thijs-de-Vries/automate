import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tasks app tables - shared by all users
  // userId is optional for backwards compatibility with existing data
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
    userId: v.optional(v.string()),
  }),

  // Packing app tables - shared by all users
  // userId is optional for backwards compatibility with existing data
  packing_trips: defineTable({
    name: v.string(),
    createdAt: v.number(),
    userId: v.optional(v.string()),
  }),

  packing_items: defineTable({
    tripId: v.id("packing_trips"),
    text: v.string(),
    category: v.string(), // "clothes", "toiletries", "electronics", "documents", "other"
    isPacked: v.boolean(),
    createdAt: v.number(),
  }).index("by_trip", ["tripId"]),
});
