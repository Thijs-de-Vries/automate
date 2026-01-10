"use node";
/**
 * Pinecone Vector Database Utilities for Dota Coach
 * 
 * Handles embedding and retrieval of coaching notes for RAG
 * Uses Pinecone's free tier with their inference API for embeddings
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { DOTA_COACH_CONFIG } from "./constants";

const PINECONE_INDEX_NAME = DOTA_COACH_CONFIG.pinecone.indexName;
const EMBEDDING_MODEL = DOTA_COACH_CONFIG.pinecone.embeddingModel;

let pineconeClient: Pinecone | null = null;

/**
 * Initialize Pinecone client (lazy)
 */
function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY not configured");
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

/**
 * Embed text using Pinecone's inference API
 */
async function embedText(text: string): Promise<number[]> {
  const pc = getPineconeClient();
  
  try {
    const embedding = await pc.inference.embed(
      EMBEDDING_MODEL,
      [text],
      { inputType: "passage" }
    );
    
    // Handle different Pinecone SDK response formats
    const embeddingData = embedding as any;
    const firstEmbedding = embeddingData.data?.[0] || embeddingData[0];
    return firstEmbedding?.values || firstEmbedding?.embedding || [];
  } catch (error) {
    console.error("Pinecone embedding error:", error);
    throw new Error("Failed to generate embedding");
  }
}

/**
 * Store a coaching note in Pinecone
 */
export async function storeCoachingNoteVector(params: {
  id: string; // Unique ID for this note
  text: string; // The coaching observation
  metadata: {
    playerId: string;
    matchId?: string;
    heroId?: number;
    heroName?: string;
    phase?: string; // "draft", "early", "mid", "late"
    category: string; // "laning", "itemization", "positioning", etc.
    timestamp: number;
  };
}): Promise<string> {
  const pc = getPineconeClient();
  const index = pc.index(PINECONE_INDEX_NAME);
  
  const embedding = await embedText(params.text);
  
  await index.upsert([
    {
      id: params.id,
      values: embedding,
      metadata: {
        ...params.metadata,
        text: params.text, // Store text in metadata for retrieval
      },
    },
  ]);
  
  return params.id;
}

/**
 * Query similar coaching notes from Pinecone
 */
export async function querySimilarNotes(params: {
  queryText: string;
  playerId: string;
  heroId?: number;
  phase?: string;
  topK?: number;
}): Promise<Array<{
  id: string;
  score: number;
  text: string;
  metadata: {
    playerId: string;
    matchId?: string;
    heroId?: number;
    heroName?: string;
    phase?: string;
    category: string;
    timestamp: number;
  };
}>> {
  const pc = getPineconeClient();
  const index = pc.index(PINECONE_INDEX_NAME);
  
  const embedding = await embedText(params.queryText);
  
  const filter: any = { playerId: { $eq: params.playerId } };
  
  if (params.heroId) {
    filter.heroId = { $eq: params.heroId };
  }
  
  if (params.phase) {
    filter.phase = { $eq: params.phase };
  }
  
  const results = await index.query({
    vector: embedding,
    topK: params.topK || 5,
    filter,
    includeMetadata: true,
  });
  
  return results.matches.map((match) => ({
    id: match.id,
    score: match.score || 0,
    text: (match.metadata?.text as string) || "",
    metadata: {
      playerId: (match.metadata?.playerId as string) || "",
      matchId: match.metadata?.matchId as string | undefined,
      heroId: match.metadata?.heroId as number | undefined,
      heroName: match.metadata?.heroName as string | undefined,
      phase: match.metadata?.phase as string | undefined,
      category: (match.metadata?.category as string) || "",
      timestamp: (match.metadata?.timestamp as number) || 0,
    },
  }));
}

/**
 * Get recent coaching notes for a player (no semantic search)
 */
export async function getRecentNotesForPlayer(params: {
  playerId: string;
  heroId?: number;
  limit?: number;
}): Promise<Array<{
  id: string;
  text: string;
  metadata: any;
}>> {
  const pc = getPineconeClient();
  const index = pc.index(PINECONE_INDEX_NAME);
  
  const filter: any = { playerId: { $eq: params.playerId } };
  
  if (params.heroId) {
    filter.heroId = { $eq: params.heroId };
  }
  
  // Fetch vectors with metadata only (no search query)
  // Note: Pinecone doesn't have a direct "list by metadata" feature
  // We use a dummy query with high topK as a workaround
  const dummyVector = new Array(1024).fill(0); // Adjust dimension as needed
  
  const results = await index.query({
    vector: dummyVector,
    topK: params.limit || 10,
    filter,
    includeMetadata: true,
  });
  
  return results.matches
    .sort((a, b) => ((b.metadata?.timestamp as number) || 0) - ((a.metadata?.timestamp as number) || 0))
    .slice(0, params.limit || 10)
    .map((match) => ({
      id: match.id,
      text: (match.metadata?.text as string) || "",
      metadata: match.metadata || {},
    }));
}

/**
 * Delete a coaching note from Pinecone
 */
export async function deleteCoachingNoteVector(id: string): Promise<void> {
  const pc = getPineconeClient();
  const index = pc.index(PINECONE_INDEX_NAME);
  
  await index.deleteOne(id);
}

/**
 * Batch store multiple coaching notes
 */
export async function batchStoreCoachingNotes(
  notes: Array<{
    id: string;
    text: string;
    metadata: {
      playerId: string;
      matchId?: string;
      heroId?: number;
      heroName?: string;
      phase?: string;
      category: string;
      timestamp: number;
    };
  }>
): Promise<void> {
  const pc = getPineconeClient();
  const index = pc.index(PINECONE_INDEX_NAME);
  
  const vectors = await Promise.all(
    notes.map(async (note) => ({
      id: note.id,
      values: await embedText(note.text),
      metadata: {
        ...note.metadata,
        text: note.text,
      },
    }))
  );
  
  // Pinecone allows up to 100 vectors per batch
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
  }
}
