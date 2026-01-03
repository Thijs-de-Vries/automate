/**
 * CRON JOBS - Scheduled tasks for the auto-m8 app
 *
 * This file defines scheduled tasks using Convex cron jobs.
 * For public transport, we schedule morning checks and
 * use ctx.scheduler.runAfter() for dynamic interval checks.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const crons = cronJobs();

// ============================================
// PUBLIC TRANSPORT - Morning disruption check
// ============================================

/**
 * Run every weekday at 06:00 to check disruptions for today's routes
 * and schedule follow-up checks based on departure times
 */
crons.daily(
  "morning-disruption-check",
  { hourUTC: 5, minuteUTC: 0 }, // 06:00 CET (UTC+1)
  internal.crons.checkMorningDisruptions
);

/**
 * Also run at 05:00 for early commuters
 */
crons.daily(
  "early-morning-disruption-check",
  { hourUTC: 4, minuteUTC: 0 }, // 05:00 CET (UTC+1)
  internal.crons.checkMorningDisruptions
);

export default crons;

// ============================================
// INTERNAL ACTION - Morning check orchestrator
// ============================================

/**
 * Check all routes scheduled for today and schedule follow-up checks
 */
export const checkMorningDisruptions = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all routes that run today
    const routes = await ctx.runQuery(internal.publicTransport.getRoutesForToday, {});

    console.log(`[Cron] Found ${routes.length} routes scheduled for today`);

    for (const route of routes) {
      // Do an immediate check
      await ctx.runAction(internal.publicTransportActions.checkRouteDisruptions, {
        routeId: route._id,
      });

      // Schedule follow-up checks based on departure time and urgency
      await scheduleFollowUpChecks(ctx, route);
    }
  },
});

/**
 * Schedule follow-up checks before departure based on urgency level
 *
 * Normal urgency:
 *   - Start 60 mins before, check every 10 mins
 *
 * Important urgency:
 *   - Start 120 mins before, check every 10 mins
 *   - Then 60 mins before, switch to every 5 mins
 */
export async function scheduleFollowUpChecks(ctx: any, route: any) {
  const now = new Date();
  
  // 1. Get current date in Amsterdam timezone to determine "today" in NL
  // This handles the case where server is UTC but user is in NL
  const amsDateString = now.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" });
  const amsDate = new Date(amsDateString);
  
  // 2. Parse route departure time (e.g. "08:00")
  const [hours, minutes] = route.departureTime.split(":").map(Number);

  // 3. Create departure date object relative to the Amsterdam date
  // We set the hours/minutes on the "Amsterdam Date" object
  const departureTarget = new Date(amsDate);
  departureTarget.setHours(hours, minutes, 0, 0);

  // 4. Calculate the difference between "Target Amsterdam Time" and "Current Amsterdam Time"
  // This difference (ms) is the same as the difference in absolute UTC time
  const msUntilDeparture = departureTarget.getTime() - amsDate.getTime();
  const minutesUntilDeparture = msUntilDeparture / 60000;

  console.log(
    `[Cron] Scheduling for ${route.name}: Now (AMS)=${amsDate.toLocaleTimeString()}, Departure (AMS)=${departureTarget.toLocaleTimeString()} (${Math.round(minutesUntilDeparture)} min away)`
  );

  // Don't schedule if departure is in the past
  if (msUntilDeparture <= 0) {
    console.log(`[Cron] Skipping ${route.name} - departure time already passed`);
    return;
  }

  let scheduledCount = 0;

  if (route.urgencyLevel === "important") {
    // Important: Check every 10 mins starting 120 mins before
    //            Then every 5 mins starting 60 mins before
    const twoHoursBefore = 120;
    const oneHourBefore = 60;

    // Schedule 10-min interval checks (120 to 60 mins before)
    for (let minsBefore = Math.min(twoHoursBefore, minutesUntilDeparture); minsBefore > oneHourBefore; minsBefore -= 10) {
      const delayMs = msUntilDeparture - (minsBefore * 60000);
      if (delayMs > 0) {
        await ctx.scheduler.runAfter(delayMs, internal.publicTransportActions.checkRouteDisruptions, {
          routeId: route._id,
        });
        scheduledCount++;
        console.log(`[Cron] -> Scheduled check at -${Math.round(minsBefore)} min`);
      }
    }

    // Schedule 5-min interval checks (60 to 0 mins before)
    for (let minsBefore = Math.min(oneHourBefore, minutesUntilDeparture); minsBefore > 0; minsBefore -= 5) {
      const delayMs = msUntilDeparture - (minsBefore * 60000);
      if (delayMs > 0) {
        await ctx.scheduler.runAfter(delayMs, internal.publicTransportActions.checkRouteDisruptions, {
          routeId: route._id,
        });
        scheduledCount++;
        console.log(`[Cron] -> Scheduled check at -${Math.round(minsBefore)} min`);
      }
    }
  } else {
    // Normal: Check every 10 mins starting 60 mins before
    const oneHourBefore = 60;

    for (let minsBefore = Math.min(oneHourBefore, minutesUntilDeparture); minsBefore > 0; minsBefore -= 10) {
      const delayMs = msUntilDeparture - (minsBefore * 60000);
      if (delayMs > 0) {
        await ctx.scheduler.runAfter(delayMs, internal.publicTransportActions.checkRouteDisruptions, {
          routeId: route._id,
        });
        scheduledCount++;
        console.log(`[Cron] -> Scheduled check at -${Math.round(minsBefore)} min`);
      }
    }
  }

  console.log(`[Cron] Scheduled ${scheduledCount} checks for ${route.name} (${route.urgencyLevel}) departing at ${route.departureTime}`);
}

// ============================================
// TODO: One-off date scheduling
// ============================================
// 
// For one-off trips (e.g., "Trip to Amsterdam on Jan 15"):
// 1. Add a daily cron that checks for routes with oneOffDate = today
// 2. Schedule checks the same way as recurring routes
// 3. Optionally mark the route as "completed" after the departure time
//
// Example:
// crons.daily(
//   "oneoff-trip-check",
//   { hourUTC: 5, minuteUTC: 0 },
//   internal.crons.checkOneOffTrips
// );
