import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================
// UTILITIES
// ============================================

/**
 * Sanitize object keys to only allow ASCII characters
 * This fixes issues with Russian/Cyrillic player names in match data
 */
function sanitizeMatchData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMatchData);
  
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Only keep ASCII characters in keys, replace non-ASCII with underscore
    const sanitizedKey = key.replace(/[^\x00-\x7F]/g, '_');
    // Skip empty keys after sanitization
    if (sanitizedKey.length > 0) {
      sanitized[sanitizedKey] = sanitizeMatchData(value);
    }
  }
  return sanitized;
}

// Lobby type 7 = Ranked Matchmaking
const RANKED_LOBBY_TYPE = 7;

// ============================================
// QUERIES
// ============================================

/**
 * Get player profile with hero pool and playstyle
 */
export const getPlayerProfile = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    return await ctx.db
      .query("dotaPlayerProfiles")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .first();
  },
});

/**
 * Get recent matches for a player
 */
export const getRecentMatches = query({
  args: { 
    playerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { playerId, limit = 20 }) => {
    return await ctx.db
      .query("dotaMatches")
      .withIndex("by_player_time", (q) => q.eq("playerId", playerId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get analysis for a specific match
 */
export const getMatchAnalysis = query({
  args: { matchId: v.id("dotaMatches") },
  handler: async (ctx, { matchId }) => {
    return await ctx.db
      .query("dotaAnalyses")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .first();
  },
});

/**
 * Get pending profile suggestions for user
 */
export const getPendingProfileSuggestions = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    return await ctx.db
      .query("dotaProfileSuggestions")
      .withIndex("by_player_status", (q) => 
        q.eq("playerId", playerId).eq("status", "pending")
      )
      .collect();
  },
});

/**
 * Get match by OpenDota match ID
 */
export const getMatchByMatchId = query({
  args: { matchId: v.string(), playerId: v.string() },
  handler: async (ctx, { matchId, playerId }) => {
    return await ctx.db
      .query("dotaMatches")
      .withIndex("by_match_id", (q) => q.eq("matchId", matchId))
      .filter((q) => q.eq(q.field("playerId"), playerId))
      .first();
  },
});

/**
 * Get all player profiles (for cron)
 */
export const getAllPlayerProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dotaPlayerProfiles")
      .collect();
  },
});

/**
 * Get all unanalyzed matches for a player in chronological order (oldest first)
 */
export const getAllUnanalyzedMatches = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const matches = await ctx.db
      .query("dotaMatches")
      .withIndex("by_player_time", (q) => q.eq("playerId", playerId))
      .filter((q) => q.eq(q.field("isAnalyzed"), false))
      .collect();
    
    // Sort by startTime ascending (oldest first)
    return matches.sort((a, b) => a.startTime - b.startTime);
  },
});

/**
 * Check which matches need analysis before a target match
 */
export const getUnanalyzedMatchesBefore = query({
  args: { 
    playerId: v.string(),
    targetStartTime: v.number(),
  },
  handler: async (ctx, { playerId, targetStartTime }) => {
    const matches = await ctx.db
      .query("dotaMatches")
      .withIndex("by_player_time", (q) => q.eq("playerId", playerId))
      .filter((q) => q.lt(q.field("startTime"), targetStartTime))
      .filter((q) => q.eq(q.field("isAnalyzed"), false))
      .collect();
    
    return matches.sort((a, b) => a.startTime - b.startTime);
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Initialize or update player profile
 */
export const upsertPlayerProfile = mutation({
  args: {
    playerId: v.string(),
    steamAccountId: v.optional(v.string()),
    updates: v.optional(v.object({
      heroPool: v.optional(v.array(v.object({
        heroId: v.number(),
        heroName: v.string(),
        proficiency: v.string(),
        notes: v.optional(v.string()),
      }))),
      playstyle: v.optional(v.string()),
      strengths: v.optional(v.array(v.string())),
      weaknesses: v.optional(v.array(v.string())),
      preferredRoles: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, { playerId, steamAccountId, updates }) => {
    const existing = await ctx.db
      .query("dotaPlayerProfiles")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .first();

    if (existing) {
      return await ctx.db.patch(existing._id, {
        ...(steamAccountId && { steamAccountId }),
        ...(updates?.heroPool && { heroPool: updates.heroPool }),
        ...(updates?.playstyle && { playstyle: updates.playstyle }),
        ...(updates?.strengths && { strengths: updates.strengths }),
        ...(updates?.weaknesses && { weaknesses: updates.weaknesses }),
        ...(updates?.preferredRoles && { preferredRoles: updates.preferredRoles }),
        updatedAt: Date.now(),
      });
    } else {
      return await ctx.db.insert("dotaPlayerProfiles", {
        playerId,
        steamAccountId,
        heroPool: updates?.heroPool || [],
        playstyle: updates?.playstyle,
        strengths: updates?.strengths || [],
        weaknesses: updates?.weaknesses || [],
        preferredRoles: updates?.preferredRoles || [],
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Store a match from OpenDota
 */
export const storeMatch = internalMutation({
  args: {
    matchId: v.string(),
    playerId: v.string(),
    accountId: v.string(),
    matchData: v.any(),
    heroId: v.number(),
    heroName: v.string(),
    won: v.boolean(),
    duration: v.number(),
    startTime: v.number(),
    gameMode: v.number(),
    lobbyType: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dotaMatches")
      .withIndex("by_match_id", (q) => q.eq("matchId", args.matchId))
      .filter((q) => q.eq(q.field("playerId"), args.playerId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("dotaMatches", {
      ...args,
      isAnalyzed: false,
      fetchedAt: Date.now(),
    });
  },
});

/**
 * Mark match as analyzed
 */
export const markMatchAnalyzed = internalMutation({
  args: { matchId: v.id("dotaMatches") },
  handler: async (ctx, { matchId }) => {
    await ctx.db.patch(matchId, { isAnalyzed: true, analysisFailed: false });
  },
});

/**
 * Mark match analysis as failed (so sequential analysis can continue)
 */
export const markMatchAnalysisFailed = internalMutation({
  args: { matchId: v.id("dotaMatches") },
  handler: async (ctx, { matchId }) => {
    await ctx.db.patch(matchId, { isAnalyzed: true, analysisFailed: true });
  },
});

/**
 * Store match analysis
 */
export const storeMatchAnalysis = internalMutation({
  args: {
    matchId: v.id("dotaMatches"),
    playerId: v.string(),
    draftAnalysis: v.string(),
    earlyGameAnalysis: v.string(),
    midGameAnalysis: v.string(),
    lateGameAnalysis: v.string(),
    overallSummary: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dotaAnalyses", {
      ...args,
      analyzedAt: Date.now(),
    });
  },
});

/**
 * Store coaching note with Pinecone ID
 */
export const storeCoachingNote = internalMutation({
  args: {
    playerId: v.string(),
    matchId: v.optional(v.id("dotaMatches")),
    heroId: v.optional(v.number()),
    heroName: v.optional(v.string()),
    phase: v.optional(v.string()),
    category: v.string(),
    observation: v.string(),
    pineconeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dotaCoachingNotes", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/**
 * Create profile suggestion from AI
 */
export const createProfileSuggestion = internalMutation({
  args: {
    playerId: v.string(),
    suggestionType: v.string(),
    suggestion: v.string(),
    reasoning: v.string(),
    suggestedData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dotaProfileSuggestions", {
      playerId: args.playerId,
      suggestionType: args.suggestionType,
      suggestion: args.suggestion,
      reasoning: args.reasoning,
      suggestedData: args.suggestedData ?? null,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/**
 * Helper to filter out undefined/null/"undefined" string values from arrays
 */
function filterValidStrings(arr: string[]): string[] {
  return arr.filter(s => s && s !== "undefined" && typeof s === "string");
}

/**
 * Accept or dismiss profile suggestion
 */
export const resolveProfileSuggestion = mutation({
  args: {
    suggestionId: v.id("dotaProfileSuggestions"),
    accept: v.boolean(),
  },
  handler: async (ctx, { suggestionId, accept }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) throw new Error("Suggestion not found");

    await ctx.db.patch(suggestionId, {
      status: accept ? "accepted" : "dismissed",
      resolvedAt: Date.now(),
    });

    // If accepted, apply the profile update
    if (accept) {
      const profile = await ctx.db
        .query("dotaPlayerProfiles")
        .withIndex("by_player", (q) => q.eq("playerId", suggestion.playerId))
        .first();

      if (profile) {
        const data = (suggestion.suggestedData as any) || {};
        // The actual value to add is in suggestion.suggestion, not suggestedData
        const suggestionText = suggestion.suggestion;
        
        if (suggestion.suggestionType === "add_strength" && suggestionText) {
          await ctx.db.patch(profile._id, {
            strengths: filterValidStrings([...profile.strengths, suggestionText]),
            updatedAt: Date.now(),
          });
        } else if (suggestion.suggestionType === "add_weakness" && suggestionText) {
          await ctx.db.patch(profile._id, {
            weaknesses: filterValidStrings([...profile.weaknesses, suggestionText]),
            updatedAt: Date.now(),
          });
        } else if (suggestion.suggestionType === "remove_weakness" && suggestionText) {
          await ctx.db.patch(profile._id, {
            weaknesses: filterValidStrings(profile.weaknesses.filter((w) => w !== suggestionText)),
            updatedAt: Date.now(),
          });
        } else if (suggestion.suggestionType === "update_hero_pool") {
          // For hero pool updates, check both data.heroPool and data.heroes
          const heroes = data.heroPool || data.heroes;
          if (heroes && Array.isArray(heroes)) {
            // Convert string hero names to hero pool entries
            const heroPool = heroes.map((h: any, idx: number) => {
              if (typeof h === "string") {
                return { heroId: idx, heroName: h, proficiency: "learning" };
              }
              return h;
            });
            await ctx.db.patch(profile._id, {
              heroPool: heroPool,
              updatedAt: Date.now(),
            });
          }
        } else {
          console.log(`Suggestion ${suggestionId} accepted but no valid data to apply`);
        }
      }
    }
  },
});

/**
 * Accept all pending profile suggestions (for CLI: npx convex run dota:acceptAllSuggestions)
 */
export const acceptAllSuggestions = mutation({
  args: { playerId: v.optional(v.string()) },
  handler: async (ctx, { playerId }) => {
    // Get all pending suggestions
    let suggestions;
    if (playerId) {
      suggestions = await ctx.db
        .query("dotaProfileSuggestions")
        .withIndex("by_player_status", (q) => q.eq("playerId", playerId).eq("status", "pending"))
        .collect();
    } else {
      suggestions = await ctx.db
        .query("dotaProfileSuggestions")
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
    }

    console.log(`Found ${suggestions.length} pending suggestions to accept`);
    let acceptedCount = 0;

    for (const suggestion of suggestions) {
      // Mark as accepted
      await ctx.db.patch(suggestion._id, {
        status: "accepted",
        resolvedAt: Date.now(),
      });

      // Apply the update
      const profile = await ctx.db
        .query("dotaPlayerProfiles")
        .withIndex("by_player", (q) => q.eq("playerId", suggestion.playerId))
        .first();

      if (profile) {
        const data = (suggestion.suggestedData as any) || {};
        // The actual value to add is in suggestion.suggestion, not suggestedData
        const suggestionText = suggestion.suggestion;
        
        if (suggestion.suggestionType === "add_strength" && suggestionText) {
          await ctx.db.patch(profile._id, {
            strengths: filterValidStrings([...profile.strengths, suggestionText]),
            updatedAt: Date.now(),
          });
          acceptedCount++;
        } else if (suggestion.suggestionType === "add_weakness" && suggestionText) {
          await ctx.db.patch(profile._id, {
            weaknesses: filterValidStrings([...profile.weaknesses, suggestionText]),
            updatedAt: Date.now(),
          });
          acceptedCount++;
        } else if (suggestion.suggestionType === "remove_weakness" && suggestionText) {
          await ctx.db.patch(profile._id, {
            weaknesses: filterValidStrings(profile.weaknesses.filter((w) => w !== suggestionText)),
            updatedAt: Date.now(),
          });
          acceptedCount++;
        } else if (suggestion.suggestionType === "update_hero_pool") {
          // For hero pool updates, check both data.heroPool and data.heroes
          const heroes = data.heroPool || data.heroes;
          if (heroes && Array.isArray(heroes)) {
            const heroPool = heroes.map((h: any, idx: number) => {
              if (typeof h === "string") {
                return { heroId: idx, heroName: h, proficiency: "learning" };
              }
              return h;
            });
            await ctx.db.patch(profile._id, {
              heroPool: heroPool,
              updatedAt: Date.now(),
            });
            acceptedCount++;
          }
        }
      }
    }

    return { total: suggestions.length, applied: acceptedCount };
  },
});

/**
 * Reprocess already accepted suggestions that weren't applied (for CLI: npx convex run dota:reapplyAcceptedSuggestions)
 */
export const reapplyAcceptedSuggestions = mutation({
  args: { playerId: v.optional(v.string()) },
  handler: async (ctx, { playerId }) => {
    // Get all accepted suggestions
    let suggestions;
    if (playerId) {
      suggestions = await ctx.db
        .query("dotaProfileSuggestions")
        .withIndex("by_player_status", (q) => q.eq("playerId", playerId).eq("status", "accepted"))
        .collect();
    } else {
      suggestions = await ctx.db
        .query("dotaProfileSuggestions")
        .filter((q) => q.eq(q.field("status"), "accepted"))
        .collect();
    }

    console.log(`Found ${suggestions.length} accepted suggestions to reprocess`);
    let appliedCount = 0;

    for (const suggestion of suggestions) {
      const profile = await ctx.db
        .query("dotaPlayerProfiles")
        .withIndex("by_player", (q) => q.eq("playerId", suggestion.playerId))
        .first();

      if (profile) {
        const data = (suggestion.suggestedData as any) || {};
        const suggestionText = suggestion.suggestion;
        
        if (suggestion.suggestionType === "add_strength" && suggestionText) {
          // Only add if not already in strengths
          if (!profile.strengths.includes(suggestionText)) {
            await ctx.db.patch(profile._id, {
              strengths: filterValidStrings([...profile.strengths, suggestionText]),
              updatedAt: Date.now(),
            });
            appliedCount++;
          }
        } else if (suggestion.suggestionType === "add_weakness" && suggestionText) {
          if (!profile.weaknesses.includes(suggestionText)) {
            await ctx.db.patch(profile._id, {
              weaknesses: filterValidStrings([...profile.weaknesses, suggestionText]),
              updatedAt: Date.now(),
            });
            appliedCount++;
          }
        } else if (suggestion.suggestionType === "update_hero_pool") {
          const heroes = data.heroPool || data.heroes;
          if (heroes && Array.isArray(heroes)) {
            const heroPool = heroes.map((h: any, idx: number) => {
              if (typeof h === "string") {
                return { heroId: idx, heroName: h, proficiency: "learning" };
              }
              return h;
            });
            await ctx.db.patch(profile._id, {
              heroPool: heroPool,
              updatedAt: Date.now(),
            });
            appliedCount++;
          }
        }
      }
    }

    return { total: suggestions.length, applied: appliedCount };
  },
});

// ============================================
// ACTIONS - External API calls
// ============================================

/**
 * Fetch match data from OpenDota API
 */
export const fetchMatchFromOpenDota = action({
  args: { 
    matchId: v.string(),
    playerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, { matchId, playerId, accountId }): Promise<Id<"dotaMatches"> | null> => {
    const apiKey = process.env.OPENDOTA_API_KEY || "";
    const url = `https://api.opendota.com/api/matches/${matchId}${apiKey ? `?api_key=${apiKey}` : ""}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenDota API error: ${response.status} ${response.statusText}`);
    }
    
    const matchData = await response.json();
    
    // Find player's data in the match
    const playerData = matchData.players?.find((p: any) => 
      p.account_id?.toString() === accountId
    );
    
    if (!playerData) {
      throw new Error("Player not found in match");
    }

    // Get hero name from constants
    const heroName = await getHeroName(playerData.hero_id);
    
    // Store the match
    const storedMatchId = await ctx.runMutation((internal as any).dota.storeMatch, {
      matchId,
      playerId,
      accountId,
      matchData,
      heroId: playerData.hero_id,
      heroName,
      won: (playerData.player_slot < 128 && matchData.radiant_win) || 
           (playerData.player_slot >= 128 && !matchData.radiant_win),
      duration: matchData.duration,
      startTime: matchData.start_time,
      gameMode: matchData.game_mode,
      lobbyType: matchData.lobby_type,
    });
    
    return storedMatchId;
  },
});

/**
 * Sync recent matches for a player
 */
export const syncPlayerMatches = action({
  args: { 
    playerId: v.string(),
    accountId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { playerId, accountId, limit = 20 }): Promise<{ syncedCount: number; total: number }> => {
    const apiKey = process.env.OPENDOTA_API_KEY || "";
    const url = `https://api.opendota.com/api/players/${accountId}/matches?limit=${limit}${apiKey ? `&api_key=${apiKey}` : ""}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenDota API error: ${response.status}`);
    }
    
    const matches = await response.json();
    let syncedCount = 0;
    
    // Filter for ranked matches only (lobby_type 7)
    const rankedMatches = matches.filter((m: any) => m.lobby_type === RANKED_LOBBY_TYPE);
    console.log(`Found ${rankedMatches.length} ranked matches out of ${matches.length} total`);
    
    for (const match of rankedMatches) {
      try {
        // Inline the fetch logic instead of calling the other action
        const matchUrl = `https://api.opendota.com/api/matches/${match.match_id}${apiKey ? `?api_key=${apiKey}` : ""}`;
        const matchResponse = await fetch(matchUrl);
        
        if (matchResponse.ok) {
          const rawMatchData = await matchResponse.json();
          // Sanitize match data to remove non-ASCII characters from keys
          const matchData = sanitizeMatchData(rawMatchData);
          const playerData = matchData.players?.find((p: any) => 
            p.account_id?.toString() === accountId
          );
          
          if (playerData) {
            const heroName = await getHeroName(playerData.hero_id);
            
            await ctx.runMutation((internal as any).dota.storeMatch, {
              matchId: match.match_id.toString(),
              playerId,
              accountId,
              matchData,
              heroId: playerData.hero_id,
              heroName,
              won: (playerData.player_slot < 128 && matchData.radiant_win) || 
                   (playerData.player_slot >= 128 && !matchData.radiant_win),
              duration: matchData.duration,
              startTime: matchData.start_time,
              gameMode: matchData.game_mode,
              lobbyType: matchData.lobby_type,
            });
            syncedCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync match ${match.match_id}:`, error);
      }
    }
    
    return { syncedCount, total: rankedMatches.length };
  },
});

/**
 * Get hero benchmarks from OpenDota
 */
export const getHeroBenchmarks = action({
  args: { heroId: v.number() },
  handler: async (ctx, { heroId }) => {
    const apiKey = process.env.OPENDOTA_API_KEY || "";
    const url = `https://api.opendota.com/api/benchmarks?hero_id=${heroId}${apiKey ? `&api_key=${apiKey}` : ""}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  },
});

// ============================================
// UTILITIES
// ============================================

/**
 * Get hero name from hero ID using dotaconstants
 */
async function getHeroName(heroId: number): Promise<string> {
  try {
    const response = await fetch("https://api.opendota.com/api/constants/heroes");
    const heroes = await response.json();
    const hero = Object.values(heroes).find((h: any) => h.id === heroId) as any;
    return hero?.localized_name || `Hero ${heroId}`;
  } catch {
    return `Hero ${heroId}`;
  }
}
