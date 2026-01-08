"use node";

/**
 * NOTIFICATIONS NODE - Push notification sending using web-push
 * 
 * This file runs in Node.js runtime (not Convex runtime) because
 * web-push requires Node.js APIs like crypto, https, etc.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import webpush from "web-push";

// ============================================
// HELPER: Setup VAPID and send notifications
// ============================================
async function sendNotifications(
  ctx: any,
  subscriptions: any[],
  payload: string
) {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("VAPID keys not configured");
    return { sent: 0, failed: 0, staleRemoved: 0 };
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let sent = 0;
  let failed = 0;
  let staleRemoved = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      sent++;
    } catch (error: unknown) {
      failed++;

      const webPushError = error as { statusCode?: number; message?: string };

      // Handle stale subscriptions (410 Gone or 404 Not Found)
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        await ctx.runMutation(internal.notifications.removeStaleSubscription, {
          endpoint: sub.endpoint,
        });
        staleRemoved++;
        console.log(`Subscription expired (${webPushError.statusCode}), removed.`);
      } else {
        console.error(`Failed to send push: ${webPushError.message}`);
      }
    }
  }

  return { sent, failed, staleRemoved };
}

// ============================================
// INTERNAL ACTION: Send push to all subscribers
// ============================================
export const sendPushToAll = internalAction({
  args: {
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all subscriptions
    const subscriptions = await ctx.runQuery(
      internal.notifications.getAllSubscriptions
    );

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url ?? "/",
      tag: args.tag,
    });

    const result = await sendNotifications(ctx, subscriptions, payload);
    console.log(`Push notifications: ${result.sent} sent, ${result.failed} failed, ${result.staleRemoved} stale removed`);
    return result;
  },
});

// ============================================
// INTERNAL ACTION: Send push to space members (opt-in only)
// ============================================
export const sendPushToSpace = internalAction({
  args: {
    spaceId: v.id("spaces"),
    module: v.union(
      v.literal("tasks"),
      v.literal("packing"),
      v.literal("transport"),
      v.literal("calisthenics")
    ),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get space members who have opted in for this module
    const optedInMembers = await ctx.runQuery(
      internal.spaces.getSpaceMembersForNotifications,
      { spaceId: args.spaceId, module: args.module }
    );

    if (optedInMembers.length === 0) {
      console.log(`No members opted in for ${args.module} notifications in this space`);
      return { sent: 0, failed: 0, staleRemoved: 0 };
    }

    // Get user IDs of opted-in members
    const userIds = optedInMembers.map((m: any) => m.userId);

    // Get all subscriptions
    const allSubscriptions = await ctx.runQuery(
      internal.notifications.getAllSubscriptions
    );

    // Filter to subscriptions for opted-in users
    const targetSubscriptions = allSubscriptions.filter((sub: any) =>
      userIds.includes(sub.userId)
    );

    if (targetSubscriptions.length === 0) {
      console.log(`No push subscriptions found for opted-in members`);
      return { sent: 0, failed: 0, staleRemoved: 0 };
    }

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url ?? "/",
      tag: args.tag,
    });

    const result = await sendNotifications(ctx, targetSubscriptions, payload);
    console.log(
      `Space push notifications (${args.module}): ${result.sent} sent to ${userIds.length} opted-in members, ${result.failed} failed`
    );
    return result;
  },
});
