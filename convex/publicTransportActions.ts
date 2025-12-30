/**
 * PUBLIC TRANSPORT ACTIONS - External API calls for the Public Transport mini-app
 *
 * Actions can make HTTP requests to external APIs (NS API).
 * They call internal mutations to persist data.
 */

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ============================================
// NS API Configuration
// ============================================
const NS_API_BASE = "https://gateway.apiportal.ns.nl";
const NS_STATIONS_ENDPOINT = "/nsapp-stations/v2";
const NS_DISRUPTIONS_ENDPOINT = "/disruptions";

// Declare process for Node.js environment variables in Convex
declare const process: { env: Record<string, string | undefined> };

function getNsApiKey(): string {
  const key = process.env.NS_API_KEY;
  if (!key) {
    throw new Error("NS_API_KEY environment variable is not set");
  }
  return key;
}

// ============================================
// STATIONS SYNC - Fetch all Dutch stations
// ============================================

/**
 * Sync all Dutch stations from NS API to our cache
 * Should be run once on deploy, or periodically (monthly)
 */
export const syncAllStations = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = getNsApiKey();

    const response = await fetch(
      `${NS_API_BASE}${NS_STATIONS_ENDPOINT}?countryCodes=nl,d,b`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`NS API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const stations = data.payload || [];

    let synced = 0;
    for (const station of stations) {
      // Skip stations without a code
      if (!station.code) continue;

      await ctx.runMutation(internal.publicTransport.upsertStation, {
        code: station.code,
        uicCode: station.UICCode || "",
        nameLong: station.namen?.lang || station.code,
        nameMedium: station.namen?.middel || station.code,
        nameShort: station.namen?.kort || station.code,
        synonyms: station.synoniemen || [],
        lat: station.lat,
        lng: station.lng,
        country: station.land || "NL",
      });

      synced++;
    }

    return { synced, total: stations.length };
  },
});

// ============================================
// DISRUPTION CHECK - Check disruptions for a route
// ============================================

/**
 * Simple hash function for content change detection
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Check disruptions for a specific route
 * Uses the /v3 endpoint to fetch ALL disruptions, then filters locally.
 * This is more reliable than /v3/station/{code} which doesn't work for all stations.
 */
export const checkRouteDisruptions = internalAction({
  args: {
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    const apiKey = getNsApiKey();

    // Get route and its stations
    const route = await ctx.runQuery(internal.publicTransport.getRouteInternal, {
      routeId: args.routeId,
    });

    if (!route) {
      console.error(`Route ${args.routeId} not found`);
      return;
    }

    // Collect all station codes to check
    const stationCodes = route.stations.map((s: { stationCode: string }) => s.stationCode);

    // Fetch ALL disruptions from the /v3 endpoint
    const allDisruptions = new Map<string, any>();

    try {
      const response = await fetch(
        `${NS_API_BASE}${NS_DISRUPTIONS_ENDPOINT}/v3?isActive=true`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch disruptions: ${response.status}`);
        return;
      }

      const disruptions = await response.json();

      // Filter disruptions that affect our route stations
      for (const disruption of disruptions) {
        const affectedStations = extractAffectedStations(disruption, stationCodes);

        if (affectedStations.length > 0 && !allDisruptions.has(disruption.id)) {
          allDisruptions.set(disruption.id, {
            ...disruption,
            affectedStations,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching disruptions:`, error);
      return;
    }

    // Upsert each disruption
    const activeDisruptionIds: string[] = [];

    for (const [disruptionId, disruption] of allDisruptions) {
      activeDisruptionIds.push(disruptionId);

      // Extract period text
      const period = extractPeriod(disruption);

      // Create content hash for change detection
      const contentHash = simpleHash(
        `${disruption.type}|${disruption.title}|${period}|${disruption.expectedDuration?.description || ""}`
      );

      await ctx.runMutation(internal.publicTransport.upsertDisruption, {
        routeId: args.routeId,
        disruptionId,
        type: disruption.type || "DISRUPTION",
        title: disruption.title || "Unknown disruption",
        description: disruption.description || "",
        period,
        advice: disruption.expectedDuration?.description,
        affectedStations: disruption.affectedStations,
        contentHash,
      });
    }

    // Mark disruptions no longer in the API as inactive
    await ctx.runMutation(internal.publicTransport.markOldDisruptionsInactive, {
      routeId: args.routeId,
      activeDisruptionIds,
    });

    // Update route status
    await ctx.runMutation(internal.publicTransport.updateRouteStatus, {
      routeId: args.routeId,
    });

    return {
      routeId: args.routeId,
      disruptionsFound: allDisruptions.size,
    };
  },
});

/**
 * Extract affected stations from a disruption that match our route
 */
function extractAffectedStations(disruption: any, routeStationCodes: string[]): string[] {
  const affected: string[] = [];

  if (disruption.publicationSections && Array.isArray(disruption.publicationSections)) {
    for (const pubSection of disruption.publicationSections) {
      if (pubSection.section && Array.isArray(pubSection.section.stations)) {
        for (const station of pubSection.section.stations) {
          if (routeStationCodes.includes(station.stationCode)) {
            affected.push(station.stationCode);
          }
        }
      }
    }
  }

  return [...new Set(affected)]; // Dedupe
}

/**
 * Extract human-readable period from disruption
 */
function extractPeriod(disruption: any): string {
  if (disruption.timespans && disruption.timespans.length > 0) {
    const timespan = disruption.timespans[0];
    const start = timespan.start ? new Date(timespan.start).toLocaleString("nl-NL") : "";
    const end = timespan.end ? new Date(timespan.end).toLocaleString("nl-NL") : "";
    
    if (start && end) {
      return `${start} - ${end}`;
    } else if (start) {
      return `Vanaf ${start}`;
    }
  }
  
  return disruption.phase || "Onbekende periode";
}

// ============================================
// MANUAL TRIGGER - Check a route on demand
// ============================================

/**
 * Manually trigger a disruption check for a route
 */
export const checkRouteNow = action({
  args: {
    routeId: v.id("pt_routes"),
  },
  handler: async (ctx, args) => {
    // Verify the user is authenticated (basic check)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in");
    }

    // Run the internal action
    await ctx.runAction(internal.publicTransportActions.checkRouteDisruptions, {
      routeId: args.routeId,
    });

    return { success: true };
  },
});

// ============================================
// ROUTE OPTIONS - Fetch trip options between stations
// ============================================

/**
 * Fetch route options between origin and destination using NS Trips API
 * Returns multiple trip options with their intermediate stations
 */
export const fetchRouteOptions = action({
  args: {
    originCode: v.string(),
    destinationCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in");
    }

    const apiKey = getNsApiKey();

    const response = await fetch(
      `${NS_API_BASE}/reisinformatie-api/api/v3/trips?fromStation=${args.originCode}&toStation=${args.destinationCode}`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch trips: ${response.status}`);
      throw new Error(`Failed to fetch route options: ${response.status}`);
    }

    const data = await response.json();
    const trips = data.trips || [];

    // Collect all unique uicCodes from all trips to batch lookup
    const allUicCodes = new Set<string>();
    for (const trip of trips) {
      for (const leg of trip.legs || []) {
        if (leg.origin?.uicCode) allUicCodes.add(leg.origin.uicCode);
        if (leg.destination?.uicCode) allUicCodes.add(leg.destination.uicCode);
        for (const stop of leg.stops || []) {
          if (stop.uicCode) allUicCodes.add(stop.uicCode);
        }
      }
    }

    // Lookup all stations by uicCode to get proper codes
    const uicToStation = new Map<string, { code: string; name: string }>();
    for (const uicCode of allUicCodes) {
      const station = await ctx.runQuery(internal.publicTransport.getStationByUicCode, { uicCode });
      if (station) {
        uicToStation.set(uicCode, { code: station.code, name: station.nameLong });
      }
    }

    // Helper to get station info from uicCode
    const getStationInfo = (item: { uicCode?: string; stationCode?: string; name?: string }) => {
      if (item.uicCode && uicToStation.has(item.uicCode)) {
        return uicToStation.get(item.uicCode)!;
      }
      // Fallback to stationCode if available and not numeric
      if (item.stationCode && !/^\d+$/.test(item.stationCode)) {
        return { code: item.stationCode, name: item.name || item.stationCode };
      }
      return null;
    };

    // Extract unique route options (dedupe by station sequence)
    const routeOptions: Array<{
      uid: string;
      durationInMinutes: number;
      transfers: number;
      stations: Array<{ code: string; name: string }>;
      viaStations: string; // Human readable "via X, Y"
    }> = [];

    const seenRoutes = new Set<string>();

    for (const trip of trips) {
      // Extract all stations from all legs
      const stations: Array<{ code: string; name: string }> = [];

      for (const leg of trip.legs || []) {
        // Skip non-train legs (walking, etc.)
        if (leg.travelType && leg.travelType !== "PUBLIC_TRANSIT") continue;

        // Add origin of this leg
        const originInfo = getStationInfo(leg.origin || {});
        if (originInfo && !stations.find(s => s.code === originInfo.code)) {
          stations.push(originInfo);
        }

        // Add intermediate stops
        for (const stop of leg.stops || []) {
          const stopInfo = getStationInfo(stop);
          if (stopInfo && !stations.find(s => s.code === stopInfo.code)) {
            stations.push(stopInfo);
          }
        }

        // Add destination of this leg
        const destInfo = getStationInfo(leg.destination || {});
        if (destInfo && !stations.find(s => s.code === destInfo.code)) {
          stations.push(destInfo);
        }
      }

      // Skip if we couldn't extract stations
      if (stations.length < 2) continue;

      // Create a route signature to dedupe similar routes
      const routeSignature = stations.map(s => s.code).join("-");
      if (seenRoutes.has(routeSignature)) continue;
      seenRoutes.add(routeSignature);

      // Get via stations (intermediate major stops)
      const viaStations = stations
        .slice(1, -1) // Exclude origin and destination
        .filter((_, i, arr) => arr.length <= 3 || i % Math.ceil(arr.length / 3) === 0) // Show max 3 via stations
        .map(s => s.name)
        .join(", ");

      routeOptions.push({
        uid: trip.uid || routeSignature,
        durationInMinutes: trip.plannedDurationInMinutes || 0,
        transfers: trip.transfers || 0,
        stations,
        viaStations: viaStations || "Direct",
      });

      // Limit to 5 options
      if (routeOptions.length >= 5) break;
    }

    return routeOptions;
  },
});
