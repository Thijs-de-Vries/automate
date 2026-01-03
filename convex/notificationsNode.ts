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
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error("VAPID keys not configured");
      return { sent: 0, failed: 0, staleRemoved: 0 };
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Get all subscriptions
    const subscriptions = await ctx.runQuery(
      internal.notifications.getAllSubscriptions
    );

    let sent = 0;
    let failed = 0;
    let staleRemoved = 0;

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url ?? "/",
      tag: args.tag,
    });

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

    console.log(`Push notifications: ${sent} sent, ${failed} failed, ${staleRemoved} stale removed`);
    return { sent, failed, staleRemoved };
  },
});
