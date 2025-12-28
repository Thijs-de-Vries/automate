import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tasks app tables
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    userId: v.string(), // Optional for migration from old data
    createdAt: v.number(), // Optional for migration from old data
  }).index("by_user", ["userId"]),

  // Packing app tables
  packing_trips: defineTable({
    name: v.string(),
    userId: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  packing_items: defineTable({
    tripId: v.id("packing_trips"),
    text: v.string(),
    category: v.string(), // "clothes", "toiletries", "electronics", "documents", "other"
    isPacked: v.boolean(),
    createdAt: v.number(),
  }).index("by_trip", ["tripId"]),
});
