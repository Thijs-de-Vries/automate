"use node";
/**
 * Dota Match Analysis with AI and RAG
 * 
 * Orchestrates match analysis using OpenRouter AI with context from
 * player profile and past coaching notes stored in Pinecone
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  storeCoachingNoteVector,
  querySimilarNotes,
  batchStoreCoachingNotes,
} from "./dotaPinecone";
import { DOTA_COACH_CONFIG } from "./constants";

// Model configuration
const OPENROUTER_MODEL = DOTA_COACH_CONFIG.model;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface AnalysisResult {
  draft: string;
  earlyGame: string;
  midGame: string;
  lateGame: string;
  overall: string;
  coachingNotes: Array<{
    phase: string;
    category: string;
    observation: string;
  }>;
  profileSuggestions: Array<{
    type: string;
    suggestion: string;
    reasoning: string;
    data: any;
  }>;
}

interface AnalyzeMatchResult {
  success: boolean;
  analysisId: Id<"dotaAnalyses">;
  analysis: AnalysisResult;
  hasSuggestions: boolean;
}

/**
 * Analyze a match with AI using RAG context
 */
export const analyzeMatch = action({
  args: {
    matchId: v.string(), // OpenDota match ID
    playerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, { matchId, playerId, accountId }): Promise<AnalyzeMatchResult> => {
    // Step 1: Check if match exists, if not fetch it
    let match = await ctx.runQuery((api as any).dota.getMatchByMatchId, {
      matchId,
      playerId,
    });

    if (!match) {
      await ctx.runAction((api as any).dota.fetchMatchFromOpenDota, {
        matchId,
        playerId,
        accountId,
      });
      match = await ctx.runQuery((api as any).dota.getMatchByMatchId, {
        matchId,
        playerId,
      });
    }

    if (!match) {
      throw new Error("Failed to fetch match data");
    }

    // Step 2: Check if there are unanalyzed matches before this one
    const unanalyzedBefore = await ctx.runQuery(
      (api as any).dota.getUnanalyzedMatchesBefore,
      {
        playerId,
        targetStartTime: match.startTime,
      }
    );

    if (unanalyzedBefore.length > 0) {
      throw new Error(
        `Cannot analyze this match yet. Please analyze ${unanalyzedBefore.length} earlier match(es) first. ` +
        `Next match to analyze: ${unanalyzedBefore[0].matchId}`
      );
    }

    // Wrap main analysis in try/catch to mark as failed on error
    try {
      // Step 3: Get player profile for context
      const profile = await ctx.runQuery((api as any).dota.getPlayerProfile, {
        playerId,
      });

      // Step 4: Get hero benchmarks
      const benchmarks = await ctx.runAction((api as any).dota.getHeroBenchmarks, {
        heroId: match.heroId,
      });

      // Step 5: Query relevant past coaching notes from Pinecone
      const similarNotes = await querySimilarNotes({
        queryText: `${match.heroName} match analysis for game phases`,
        playerId,
        heroId: match.heroId,
        topK: DOTA_COACH_CONFIG.pinecone.topK,
      });

      // Step 6: Build AI prompt with all context
      const prompt = buildAnalysisPrompt({
        match,
        profile,
        benchmarks,
        similarNotes,
      });

      // Step 7: Call OpenRouter AI
      const analysis = await callOpenRouterAI(prompt);

      // Step 8: Store analysis in Convex
      const analysisId: Id<"dotaAnalyses"> = await ctx.runMutation(
        (internal as any).dota.storeMatchAnalysis,
        {
          matchId: match._id,
          playerId,
          draftAnalysis: analysis.draft,
          earlyGameAnalysis: analysis.earlyGame,
          midGameAnalysis: analysis.midGame,
          lateGameAnalysis: analysis.lateGame,
          overallSummary: analysis.overall,
          modelUsed: OPENROUTER_MODEL,
        }
      );

      // Step 9: Store coaching notes in Pinecone (skip if empty)
      if (analysis.coachingNotes.length > 0) {
        const notePromises = analysis.coachingNotes.map(async (note, idx) => {
          const noteId = `${match._id}_note_${idx}_${Date.now()}`;
          await storeCoachingNoteVector({
            id: noteId,
            text: note.observation,
            metadata: {
              playerId,
              matchId: match._id,
              heroId: match.heroId,
              heroName: match.heroName,
              phase: note.phase,
              category: note.category,
              timestamp: Date.now(),
            },
          });

          return ctx.runMutation((internal as any).dota.storeCoachingNote, {
            playerId,
            matchId: match._id,
            heroId: match.heroId,
            heroName: match.heroName,
            phase: note.phase,
            category: note.category,
            observation: note.observation,
            pineconeId: noteId,
          });
        });

        await Promise.all(notePromises);
      }

      // Step 10: Create profile suggestions if AI detected patterns
      if (analysis.profileSuggestions.length > 0) {
        const suggestionPromises = analysis.profileSuggestions.map((suggestion) =>
          ctx.runMutation((internal as any).dota.createProfileSuggestion, {
            playerId,
            suggestionType: suggestion.type,
            suggestion: suggestion.suggestion,
            reasoning: suggestion.reasoning,
            suggestedData: suggestion.data,
          })
        );
        await Promise.all(suggestionPromises);
      }

      // Step 11: Mark match as analyzed
      await ctx.runMutation((internal as any).dota.markMatchAnalyzed, {
        matchId: match._id,
      });

      return {
        success: true,
        analysisId,
        analysis,
        hasSuggestions: analysis.profileSuggestions.length > 0,
      };
    } catch (error: any) {
      // Mark this match as failed so sequential analysis can continue
      console.error(`Failed to analyze match ${matchId}:`, error);
      await ctx.runMutation((internal as any).dota.markMatchAnalysisFailed, {
        matchId: match._id,
      });
      throw error; // Re-throw so the frontend knows it failed
    }
  },
});

/**
 * Chat with AI about general playstyle/hero pool
 */
export const chatWithCoach = action({
  args: {
    playerId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { playerId, message }): Promise<{ message: string; hasSuggestion: boolean }> => {
    // Get player profile
    const profile = await ctx.runQuery((api as any).dota.getPlayerProfile, {
      playerId,
    });

    // Build chat prompt
    const prompt = buildChatPrompt({
      profile,
      userMessage: message,
    });

    // Call OpenRouter AI
    const response = await callOpenRouterAIChat(prompt);

    // Check if AI wants to update profile
    if (response.wantsToUpdateProfile && response.profileUpdate) {
      await ctx.runMutation((internal as any).dota.createProfileSuggestion, {
        playerId,
        suggestionType: response.profileUpdate.type,
        suggestion: response.profileUpdate.suggestion,
        reasoning: response.profileUpdate.reasoning,
        suggestedData: response.profileUpdate.data,
      });
    }

    return {
      message: response.message,
      hasSuggestion: response.wantsToUpdateProfile,
    };
  },
});

/**
 * Build analysis prompt with all context
 */
function buildAnalysisPrompt(params: {
  match: any;
  profile: any;
  benchmarks: any;
  similarNotes: Array<{ text: string; metadata: any; score: number }>;
}): string {
  const { match, profile, benchmarks, similarNotes } = params;
  const matchData = match.matchData;
  const playerData = matchData.players?.find(
    (p: any) => p.account_id?.toString() === match.accountId
  );

  return `You are an expert Dota 2 coach. Analyze this match and provide detailed coaching.

## PLAYER PROFILE
${profile ? `
Hero Pool: ${profile.heroPool.map((h: any) => `${h.heroName} (${h.proficiency})`).join(", ") || "Not specified"}
Playstyle: ${profile.playstyle || "Not specified"}
Strengths: ${profile.strengths.join(", ") || "Not identified yet"}
Weaknesses: ${profile.weaknesses.join(", ") || "Not identified yet"}
Preferred Roles: ${profile.preferredRoles.join(", ") || "Not specified"}
` : "No profile data yet"}

## PAST COACHING NOTES (RAG Context)
${similarNotes.length > 0 ? similarNotes.map(n => `- [${n.metadata.phase}/${n.metadata.category}] ${n.text}`).join("\n") : "No past notes for this hero"}

## MATCH DATA
Match ID: ${match.matchId}
Hero: ${match.heroName}
Result: ${match.won ? "WON" : "LOST"}
Duration: ${Math.floor(match.duration / 60)}m ${match.duration % 60}s
KDA: ${playerData?.kills}/${playerData?.deaths}/${playerData?.assists}
GPM: ${playerData?.gold_per_min}
XPM: ${playerData?.xp_per_min}
Last Hits: ${playerData?.last_hits}
Denies: ${playerData?.denies}
Hero Damage: ${playerData?.hero_damage}
Tower Damage: ${playerData?.tower_damage}
Items: ${playerData?.item_0}, ${playerData?.item_1}, ${playerData?.item_2}, ${playerData?.item_3}, ${playerData?.item_4}, ${playerData?.item_5}

${benchmarks ? `## BENCHMARKS (for ${match.heroName})
Compare the player's stats to these average values for this hero at different skill percentiles.
GPM: ${JSON.stringify(benchmarks.result?.gold_per_min)}
XPM: ${JSON.stringify(benchmarks.result?.xp_per_min)}
` : ""}

## YOUR TASK
Provide a phase-by-phase analysis:

1. **DRAFT ANALYSIS**: Did they pick the right hero for their hero pool? Was it a good pick given the matchup? Consider team composition.

2. **EARLY GAME (0-15 min)**: Analyze laning phase, CS, deaths, item timing. Compare to benchmarks.

3. **MID GAME (15-30 min)**: Team fights, objectives, positioning, item choices.

4. **LATE GAME (30+ min)**: High-value plays, positioning, game-ending decisions.

5. **OVERALL SUMMARY**: Key takeaways and actionable improvement areas.

6. **COACHING NOTES**: Extract 3-5 specific observations for RAG storage (format: phase, category, observation).

7. **PROFILE SUGGESTIONS**: If you notice NEW patterns (3+ matches) or outdated information, suggest profile updates. Only suggest if there's clear evidence from this analysis combined with past notes.

Respond in JSON format:
{
  "draft": "...",
  "earlyGame": "...",
  "midGame": "...",
  "lateGame": "...",
  "overall": "...",
  "coachingNotes": [
    {"phase": "early|mid|late", "category": "laning|itemization|positioning|map_awareness|...", "observation": "..."}
  ],
  "profileSuggestions": [
    {"type": "add_strength|add_weakness|remove_weakness|update_hero_pool", "suggestion": "...", "reasoning": "...", "data": {...}}
  ]
}`;
}

/**
 * Build chat prompt for general conversation
 */
function buildChatPrompt(params: {
  profile: any;
  userMessage: string;
}): string {
  const { profile, userMessage } = params;

  return `You are a Dota 2 coach having a conversation with a player about their playstyle and hero pool.

## PLAYER PROFILE
${profile ? `
Hero Pool: ${profile.heroPool.map((h: any) => `${h.heroName} (${h.proficiency})`).join(", ") || "Not specified"}
Playstyle: ${profile.playstyle || "Not specified"}
Strengths: ${profile.strengths.join(", ") || "Not identified yet"}
Weaknesses: ${profile.weaknesses.join(", ") || "Not identified yet"}
Preferred Roles: ${profile.preferredRoles.join(", ") || "Not specified"}
` : "No profile data yet"}

## USER MESSAGE
${userMessage}

## YOUR TASK
1. Respond naturally and helpfully to the user's message
2. If the user shares information worth storing in their profile (hero preferences, playstyle, strengths, weaknesses), indicate that you want to update the profile

Respond in JSON format:
{
  "message": "Your response to the user",
  "wantsToUpdateProfile": true|false,
  "profileUpdate": {
    "type": "add_strength|add_weakness|update_hero_pool|update_playstyle",
    "suggestion": "Human-readable suggestion",
    "reasoning": "Why this should be added",
    "data": {...}
  }
}`;
}

/**
 * Call OpenRouter AI for match analysis
 */
async function callOpenRouterAI(prompt: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://automate-dota-coach.app",
      "X-Title": "Dota Coach",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI");
  }

  let parsed;
  try {
    // Try to parse JSON, cleaning up common issues
    let cleanContent = content.trim();
    // Remove markdown code blocks if present
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("```")) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();
    
    parsed = JSON.parse(cleanContent);
  } catch (parseError) {
    console.error("Failed to parse AI response:", content);
    // Return default analysis if JSON parsing fails
    return {
      draft: "Unable to parse AI analysis. Please try again.",
      earlyGame: "",
      midGame: "",
      lateGame: "",
      overall: content, // Include raw response in overall
      coachingNotes: [],
      profileSuggestions: [],
    };
  }

  // Filter out invalid profileSuggestions (must have type, suggestion, reasoning)
  const validSuggestions = (parsed.profileSuggestions || []).filter((s: any) => 
    s && s.type && s.suggestion && s.reasoning && 
    s.type !== "undefined" && s.suggestion !== "undefined"
  );

  return {
    draft: parsed.draft || "",
    earlyGame: parsed.earlyGame || "",
    midGame: parsed.midGame || "",
    lateGame: parsed.lateGame || "",
    overall: parsed.overall || "",
    coachingNotes: (parsed.coachingNotes || []).filter((n: any) => n && n.observation),
    profileSuggestions: validSuggestions,
  };
}

/**
 * Call OpenRouter AI for chat
 */
async function callOpenRouterAIChat(prompt: string): Promise<{
  message: string;
  wantsToUpdateProfile: boolean;
  profileUpdate?: any;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://automate-dota-coach.app",
      "X-Title": "Dota Coach",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content);
}
