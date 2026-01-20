/**
 * APARTMENT MIGRATION
 * 
 * One-time migration script to convert apartment items from old 5-status workflow
 * (pending/approved/rejected/ordered/delivered) to new 2-status model (active/purchased).
 * 
 * Run this once in the Convex dashboard after deploying the schema changes.
 * Navigate to: Dashboard > Functions > apartmentMigration > migrateToNewStatusModel > Run
 */

import { internalMutation } from "./_generated/server";

export const migrateToNewStatusModel = internalMutation({
  handler: async (ctx) => {
    console.log("Starting apartment items migration...");
    
    const items = await ctx.db.query("apartment_items").collect();
    console.log(`Found ${items.length} items to migrate`);
    
    let migratedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      // Skip items that are already migrated (have new status values)
      if (item.status === "active" || item.status === "purchased") {
        skippedCount++;
        continue;
      }

      // Delete rejected items
      if (item.status === "rejected") {
        // Delete comments first
        const comments = await ctx.db
          .query("apartment_comments")
          .withIndex("by_item", (q) => q.eq("itemId", item._id))
          .collect();
        
        for (const comment of comments) {
          await ctx.db.delete(comment._id);
        }
        
        await ctx.db.delete(item._id);
        deletedCount++;
        console.log(`Deleted rejected item: ${item.name}`);
        continue;
      }

      // Map old statuses to new
      let newStatus: "active" | "purchased";
      const updates: any = {
        updatedAt: Date.now(),
      };

      if (item.status === "delivered") {
        // Delivered items become purchased
        newStatus = "purchased";
        updates.status = newStatus;
        
        // Map old fields to new
        if ((item as any).deliveredDate) {
          updates.purchasedAt = (item as any).deliveredDate;
        }
        if ((item as any).approvedBy) {
          updates.purchasedBy = (item as any).approvedBy;
          updates.purchasedByName = (item as any).approvedByName;
        }
        if ((item as any).actualPrice) {
          updates.price = (item as any).actualPrice;
        }
      } else {
        // pending, approved, ordered → active
        newStatus = "active";
        updates.status = newStatus;
      }

      // Remove old fields (set to undefined to delete)
      updates.approvedBy = undefined;
      updates.approvedByName = undefined;
      updates.rejectedBy = undefined;
      updates.rejectedByName = undefined;
      updates.rejectionReason = undefined;
      updates.orderedDate = undefined;
      updates.deliveredDate = undefined;
      updates.actualPrice = undefined; // Renamed to 'price'

      await ctx.db.patch(item._id, updates);
      migratedCount++;
      console.log(`Migrated: ${item.name} (${(item as any).status} → ${newStatus})`);
    }

    const summary = {
      total: items.length,
      migrated: migratedCount,
      deleted: deletedCount,
      skipped: skippedCount,
    };
    
    console.log("Migration complete:", summary);
    return summary;
  },
});
