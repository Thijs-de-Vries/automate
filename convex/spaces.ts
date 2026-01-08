/**
 * SPACES - Collaborative spaces/groups management
 * 
 * Spaces are collaborative containers where users can share tasks, packing lists,
 * routes, and other automations. Each user has a permanent "Personal" space.
 * 
 * Roles:
 * - creator: Original creator, full control, cannot leave (only delete)
 * - admin: Can manage members and settings
 * - member: Can use automations, cannot manage
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Default notification preferences (all opt-in = false)
const DEFAULT_NOTIFICATION_PREFS = {
  tasks: false,
  packing: false,
  transport: false,
  calisthenics: false,
};

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
// HELPER: Generate invite code (join-m8te-XXXXX)
// ============================================
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 for clarity
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `join-m8te-${code}`;
}

// ============================================
// HELPER: Check if user is member of space
// ============================================
async function getSpaceMembership(
  ctx: any,
  spaceId: Id<"spaces">,
  userId: string
) {
  return await ctx.db
    .query("space_members")
    .withIndex("by_space_and_user", (q: any) =>
      q.eq("spaceId", spaceId).eq("userId", userId)
    )
    .first();
}

// ============================================
// HELPER: Check access and return membership
// ============================================
async function requireSpaceAccess(
  ctx: any,
  spaceId: Id<"spaces">,
  userId: string
) {
  const membership = await getSpaceMembership(ctx, spaceId, userId);
  if (!membership) {
    throw new Error("You don't have access to this space");
  }
  return membership;
}

// ============================================
// HELPER: Check if user can manage space (creator or admin)
// ============================================
async function requireSpaceManagement(
  ctx: any,
  spaceId: Id<"spaces">,
  userId: string
) {
  const membership = await requireSpaceAccess(ctx, spaceId, userId);
  if (membership.role === "member") {
    throw new Error("You don't have permission to manage this space");
  }
  return membership;
}

// ============================================
// INTERNAL: Ensure user has personal space
// ============================================
export const ensurePersonalSpace = internalMutation({
  args: { 
    userId: v.string(),
    userName: v.optional(v.string()),
    userImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if personal space already exists
    const existingMemberships = await ctx.db
      .query("space_members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const membership of existingMemberships) {
      const space = await ctx.db.get(membership.spaceId);
      if (space?.isPersonal && space.createdBy === args.userId) {
        return space._id;
      }
    }

    // Create personal space
    const spaceId = await ctx.db.insert("spaces", {
      displayName: "Personal",
      iconName: "Home",
      isPersonal: true,
      createdBy: args.userId,
      createdAt: Date.now(),
    });

    // Add user as creator
    await ctx.db.insert("space_members", {
      spaceId,
      userId: args.userId,
      userName: args.userName,
      userImageUrl: args.userImageUrl,
      role: "creator",
      notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
      joinedAt: Date.now(),
    });

    return spaceId;
  },
});

// ============================================
// QUERY: Get user's spaces
// ============================================
export const getUserSpaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const memberships = await ctx.db
      .query("space_members")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const spaces = await Promise.all(
      memberships.map(async (m) => {
        const space = await ctx.db.get(m.spaceId);
        if (!space) return null;
        return {
          ...space,
          role: m.role,
          notificationPreferences: m.notificationPreferences,
        };
      })
    );

    return spaces.filter(Boolean);
  },
});

// ============================================
// MUTATION: Ensure personal space exists (called from frontend)
// ============================================
export const ensurePersonalSpaceExists = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in");
    }

    // Check if personal space already exists
    const existingMemberships = await ctx.db
      .query("space_members")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const membership of existingMemberships) {
      const space = await ctx.db.get(membership.spaceId);
      if (space?.isPersonal && space.createdBy === identity.subject) {
        // Update user name if missing
        if (!membership.userName && identity.name) {
          await ctx.db.patch(membership._id, {
            userName: identity.name ?? identity.email ?? undefined,
            userImageUrl: identity.pictureUrl ?? undefined,
          });
        }
        return space._id;
      }
    }

    // Create personal space
    const spaceId = await ctx.db.insert("spaces", {
      displayName: "Personal",
      iconName: "Home",
      isPersonal: true,
      createdBy: identity.subject,
      createdAt: Date.now(),
    });

    // Add user as creator
    await ctx.db.insert("space_members", {
      spaceId,
      userId: identity.subject,
      userName: identity.name ?? identity.email ?? undefined,
      userImageUrl: identity.pictureUrl ?? undefined,
      role: "creator",
      notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
      joinedAt: Date.now(),
    });

    return spaceId;
  },
});

// ============================================
// QUERY: Get space details with members
// ============================================
export const getSpaceDetails = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const membership = await getSpaceMembership(ctx, args.spaceId, identity.subject);
    if (!membership) {
      return null;
    }

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      return null;
    }

    const members = await ctx.db
      .query("space_members")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const invites = await ctx.db
      .query("space_invites")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    return {
      ...space,
      role: membership.role,
      notificationPreferences: membership.notificationPreferences,
      members,
      invites: invites.filter((i) => {
        // Filter out expired invites
        if (i.expiresAt && i.expiresAt < Date.now()) return false;
        // Filter out maxed-out invites
        if (i.maxUses && i.useCount >= i.maxUses) return false;
        return true;
      }),
    };
  },
});

// ============================================
// QUERY: Get active space ID for user
// ============================================
export const getActiveSpaceId = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return prefs?.activeSpaceId ?? null;
  },
});

// ============================================
// MUTATION: Set active space
// ============================================
export const setActiveSpace = mutation({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Verify user has access to this space
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (prefs) {
      await ctx.db.patch(prefs._id, {
        activeSpaceId: args.spaceId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userPreferences", {
        clerkId: identity.subject,
        favoriteAutomations: [],
        activeSpaceId: args.spaceId,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================
// MUTATION: Create a new space
// ============================================
export const createSpace = mutation({
  args: {
    displayName: v.string(),
    iconName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const spaceId = await ctx.db.insert("spaces", {
      displayName: args.displayName,
      iconName: args.iconName,
      isPersonal: false,
      createdBy: identity.subject,
      createdAt: Date.now(),
    });

    // Add creator as member with creator role
    await ctx.db.insert("space_members", {
      spaceId,
      userId: identity.subject,
      userName: identity.name ?? identity.email ?? undefined,
      userImageUrl: identity.pictureUrl ?? undefined,
      role: "creator",
      notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
      joinedAt: Date.now(),
    });

    return spaceId;
  },
});

// ============================================
// MUTATION: Update space settings
// ============================================
export const updateSpace = mutation({
  args: {
    spaceId: v.id("spaces"),
    displayName: v.optional(v.string()),
    iconName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceManagement(ctx, args.spaceId, identity.subject);

    const updates: any = {};
    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.iconName !== undefined) updates.iconName = args.iconName;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.spaceId, updates);
    }
  },
});

// ============================================
// MUTATION: Delete space (with confirmation)
// ============================================
export const deleteSpace = mutation({
  args: {
    spaceId: v.id("spaces"),
    confirmationName: v.string(), // Must match space name exactly
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    if (space.isPersonal) {
      throw new Error("Cannot delete your personal space");
    }

    const membership = await requireSpaceAccess(ctx, args.spaceId, identity.subject);
    if (membership.role !== "creator") {
      throw new Error("Only the creator can delete this space");
    }

    if (args.confirmationName !== space.displayName) {
      throw new Error("Confirmation name doesn't match");
    }

    // Delete all data in this space
    // Tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    // Packing trips and items
    const trips = await ctx.db
      .query("packing_trips")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const trip of trips) {
      const items = await ctx.db
        .query("packing_items")
        .withIndex("by_trip", (q) => q.eq("tripId", trip._id))
        .collect();
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(trip._id);
    }

    // Routes and related data
    const routes = await ctx.db
      .query("pt_routes")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const route of routes) {
      // Route stations
      const stations = await ctx.db
        .query("pt_route_stations")
        .withIndex("by_route", (q) => q.eq("routeId", route._id))
        .collect();
      for (const station of stations) {
        await ctx.db.delete(station._id);
      }
      // Disruptions
      const disruptions = await ctx.db
        .query("pt_disruptions")
        .withIndex("by_route", (q) => q.eq("routeId", route._id))
        .collect();
      for (const d of disruptions) {
        await ctx.db.delete(d._id);
      }
      // Status
      const statuses = await ctx.db
        .query("pt_route_status")
        .withIndex("by_route", (q) => q.eq("routeId", route._id))
        .collect();
      for (const s of statuses) {
        await ctx.db.delete(s._id);
      }
      await ctx.db.delete(route._id);
    }

    // Calisthenics exercises
    const exercises = await ctx.db
      .query("calisthenics")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const ex of exercises) {
      await ctx.db.delete(ex._id);
    }

    // Delete invites
    const invites = await ctx.db
      .query("space_invites")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    // Delete members
    const members = await ctx.db
      .query("space_members")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Finally delete space
    await ctx.db.delete(args.spaceId);
  },
});

// ============================================
// MUTATION: Generate invite code
// ============================================
export const createInviteCode = mutation({
  args: {
    spaceId: v.id("spaces"),
    expiresInHours: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceManagement(ctx, args.spaceId, identity.subject);

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    if (space.isPersonal) {
      throw new Error("Cannot invite others to personal space");
    }

    // Generate unique code
    let code = generateInviteCode();
    let existing = await ctx.db
      .query("space_invites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    // Retry if collision (very unlikely)
    while (existing) {
      code = generateInviteCode();
      existing = await ctx.db
        .query("space_invites")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    const inviteId = await ctx.db.insert("space_invites", {
      spaceId: args.spaceId,
      code,
      createdBy: identity.subject,
      createdAt: Date.now(),
      expiresAt: args.expiresInHours
        ? Date.now() + args.expiresInHours * 60 * 60 * 1000
        : undefined,
      maxUses: args.maxUses,
      useCount: 0,
    });

    return { inviteId, code };
  },
});

// ============================================
// MUTATION: Revoke invite code
// ============================================
export const revokeInviteCode = mutation({
  args: { inviteId: v.id("space_invites") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }

    await requireSpaceManagement(ctx, invite.spaceId, identity.subject);
    await ctx.db.delete(args.inviteId);
  },
});

// ============================================
// MUTATION: Join space with invite code
// ============================================
export const joinWithCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const invite = await ctx.db
      .query("space_invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!invite) {
      throw new Error("Invalid invite code");
    }

    // Check expiry
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new Error("This invite code has expired");
    }

    // Check max uses
    if (invite.maxUses && invite.useCount >= invite.maxUses) {
      throw new Error("This invite code has reached its usage limit");
    }

    // Check if already a member
    const existingMembership = await getSpaceMembership(
      ctx,
      invite.spaceId,
      identity.subject
    );
    if (existingMembership) {
      throw new Error("You're already a member of this space");
    }

    // Add as member
    await ctx.db.insert("space_members", {
      spaceId: invite.spaceId,
      userId: identity.subject,
      userName: identity.name ?? identity.email ?? undefined,
      userImageUrl: identity.pictureUrl ?? undefined,
      role: "member",
      notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
      joinedAt: Date.now(),
    });

    // Increment use count
    await ctx.db.patch(invite._id, {
      useCount: invite.useCount + 1,
    });

    const space = await ctx.db.get(invite.spaceId);
    return { spaceId: invite.spaceId, spaceName: space?.displayName };
  },
});

// ============================================
// MUTATION: Update member role
// ============================================
export const updateMemberRole = mutation({
  args: {
    spaceId: v.id("spaces"),
    memberId: v.id("space_members"),
    newRole: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const myMembership = await requireSpaceAccess(ctx, args.spaceId, identity.subject);
    if (myMembership.role !== "creator") {
      throw new Error("Only the creator can change member roles");
    }

    const targetMember = await ctx.db.get(args.memberId);
    if (!targetMember || targetMember.spaceId !== args.spaceId) {
      throw new Error("Member not found in this space");
    }

    if (targetMember.role === "creator") {
      throw new Error("Cannot change creator's role");
    }

    await ctx.db.patch(args.memberId, { role: args.newRole });
  },
});

// ============================================
// MUTATION: Remove member
// ============================================
export const removeMember = mutation({
  args: {
    spaceId: v.id("spaces"),
    memberId: v.id("space_members"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceManagement(ctx, args.spaceId, identity.subject);

    const targetMember = await ctx.db.get(args.memberId);
    if (!targetMember || targetMember.spaceId !== args.spaceId) {
      throw new Error("Member not found in this space");
    }

    if (targetMember.role === "creator") {
      throw new Error("Cannot remove the creator");
    }

    await ctx.db.delete(args.memberId);
  },
});

// ============================================
// MUTATION: Leave space
// ============================================
export const leaveSpace = mutation({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    const membership = await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    if (membership.role === "creator") {
      throw new Error("Creator cannot leave. Transfer ownership or delete the space.");
    }

    await ctx.db.delete(membership._id);
  },
});

// ============================================
// MUTATION: Update notification preferences
// ============================================
export const updateNotificationPreferences = mutation({
  args: {
    spaceId: v.id("spaces"),
    module: v.union(
      v.literal("tasks"),
      v.literal("packing"),
      v.literal("transport"),
      v.literal("calisthenics")
    ),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const membership = await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const newPrefs = {
      ...membership.notificationPreferences,
      [args.module]: args.enabled,
    };

    await ctx.db.patch(membership._id, {
      notificationPreferences: newPrefs,
    });
  },
});

// ============================================
// INTERNAL QUERY: Get space members for notifications
// ============================================
export const getSpaceMembersForNotifications = internalQuery({
  args: {
    spaceId: v.id("spaces"),
    module: v.string(),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("space_members")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    // Filter to members who have opted in for this module
    return members.filter((m) => {
      const prefs = m.notificationPreferences as Record<string, boolean>;
      return prefs[args.module] === true;
    });
  },
});

// ============================================
// INTERNAL QUERY: Get user's personal space ID
// ============================================
export const getPersonalSpaceId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("space_members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const membership of memberships) {
      const space = await ctx.db.get(membership.spaceId);
      if (space?.isPersonal && space.createdBy === args.userId) {
        return space._id;
      }
    }

    return null;
  },
});

// ============================================
// INTERNAL MUTATION: Migrate existing data to personal spaces
// Run this once after deploying the spaces feature.
// It assigns all existing tasks, trips, routes, and exercises
// without a spaceId to their creator's personal space.
// ============================================
export const migrateDataToPersonalSpaces = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stats = {
      tasks: 0,
      trips: 0,
      routes: 0,
      exercises: 0,
      errors: [] as string[],
    };

    // Helper to get or create personal space for a user
    const getOrCreatePersonalSpace = async (userId: string) => {
      // Check if user already has a personal space
      const memberships = await ctx.db
        .query("space_members")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      for (const membership of memberships) {
        const space = await ctx.db.get(membership.spaceId);
        if (space?.isPersonal && space.createdBy === userId) {
          return space._id;
        }
      }

      // Create personal space for user
      const spaceId = await ctx.db.insert("spaces", {
        displayName: "Personal",
        iconName: "User",
        isPersonal: true,
        createdBy: userId,
        createdAt: Date.now(),
      });

      await ctx.db.insert("space_members", {
        spaceId,
        userId,
        // Note: userName not available during migration - will be updated on next login
        role: "creator",
        notificationPreferences: {
          tasks: false,
          packing: false,
          transport: false,
          calisthenics: false,
        },
        joinedAt: Date.now(),
      });

      return spaceId;
    };

    // Migrate tasks
    const tasks = await ctx.db.query("tasks").collect();
    for (const task of tasks) {
      if (!task.spaceId && task.userId) {
        try {
          const personalSpaceId = await getOrCreatePersonalSpace(task.userId);
          await ctx.db.patch(task._id, { spaceId: personalSpaceId });
          stats.tasks++;
        } catch (e) {
          stats.errors.push(`Task ${task._id}: ${e}`);
        }
      }
    }

    // Migrate packing trips
    const trips = await ctx.db.query("packing_trips").collect();
    for (const trip of trips) {
      if (!trip.spaceId && trip.userId) {
        try {
          const personalSpaceId = await getOrCreatePersonalSpace(trip.userId);
          await ctx.db.patch(trip._id, { spaceId: personalSpaceId });
          stats.trips++;
        } catch (e) {
          stats.errors.push(`Trip ${trip._id}: ${e}`);
        }
      }
    }

    // Migrate public transport routes
    const routes = await ctx.db.query("pt_routes").collect();
    for (const route of routes) {
      if (!route.spaceId && route.userId) {
        try {
          const personalSpaceId = await getOrCreatePersonalSpace(route.userId);
          await ctx.db.patch(route._id, { spaceId: personalSpaceId });
          stats.routes++;
        } catch (e) {
          stats.errors.push(`Route ${route._id}: ${e}`);
        }
      }
    }

    // Migrate calisthenics exercises
    const exercises = await ctx.db.query("calisthenics").collect();
    for (const exercise of exercises) {
      if (!exercise.spaceId && exercise.userId) {
        try {
          const personalSpaceId = await getOrCreatePersonalSpace(exercise.userId);
          await ctx.db.patch(exercise._id, { spaceId: personalSpaceId });
          stats.exercises++;
        } catch (e) {
          stats.errors.push(`Exercise ${exercise._id}: ${e}`);
        }
      }
    }

    return stats;
  },
});
