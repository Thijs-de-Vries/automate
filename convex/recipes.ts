/**
 * RECIPES - Database operations for the Recipe mini-app
 *
 * This file contains all the backend functions for recipe management.
 * Features:
 * - Normalized ingredient model for future nutrition/pantry/shopping integration
 * - Freeform types and categories with autocomplete verification
 * - Filtering by type, prep time, and available ingredients
 *
 * - query = read data (like SELECT in SQL)
 * - mutation = write data (like INSERT, UPDATE, DELETE in SQL)
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
// HELPER: Check user has access to space
// ============================================
async function requireSpaceAccess(ctx: any, spaceId: any, userId: string) {
  const membership = await ctx.db
    .query("space_members")
    .withIndex("by_space_and_user", (q: any) =>
      q.eq("spaceId", spaceId).eq("userId", userId)
    )
    .first();

  if (!membership) {
    throw new Error("You don't have access to this space");
  }
  return membership;
}

// ============================================
// RECIPE TYPES
// ============================================

/**
 * List all recipe types in a space
 */
export const listTypes = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const types = await ctx.db
      .query("recipe_types")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    return types.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Create a new recipe type (or return existing)
 */
export const upsertType = mutation({
  args: {
    name: v.string(),
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    // Check if type already exists
    const existing = await ctx.db
      .query("recipe_types")
      .withIndex("by_space_and_name", (q) =>
        q.eq("spaceId", args.spaceId).eq("name", args.name)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new type
    return await ctx.db.insert("recipe_types", {
      name: args.name,
      spaceId: args.spaceId,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// INGREDIENT CATEGORIES
// ============================================

/**
 * List all ingredient categories in a space
 */
export const listCategories = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const categories = await ctx.db
      .query("ingredient_categories")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    return categories.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Create a new ingredient category (or return existing)
 */
export const upsertCategory = mutation({
  args: {
    name: v.string(),
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    // Check if category already exists
    const existing = await ctx.db
      .query("ingredient_categories")
      .withIndex("by_space_and_name", (q) =>
        q.eq("spaceId", args.spaceId).eq("name", args.name)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new category
    return await ctx.db.insert("ingredient_categories", {
      name: args.name,
      spaceId: args.spaceId,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// INGREDIENTS
// ============================================

/**
 * List all ingredients in a space
 */
export const listIngredients = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    // Get all categories for joining
    const categories = await ctx.db
      .query("ingredient_categories")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const categoryMap = new Map(categories.map((c) => [c._id, c]));

    return ingredients
      .map((ing) => ({
        ...ing,
        category: ing.categoryId ? categoryMap.get(ing.categoryId) : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Create a new ingredient (or return existing)
 */
export const upsertIngredient = mutation({
  args: {
    name: v.string(),
    spaceId: v.id("spaces"),
    categoryId: v.optional(v.id("ingredient_categories")),
    defaultUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    // Check if ingredient already exists (case-insensitive search)
    const allIngredients = await ctx.db
      .query("ingredients")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    const existing = allIngredients.find(
      (ing) => ing.name.toLowerCase() === args.name.toLowerCase()
    );

    if (existing) {
      return existing._id;
    }

    // Create new ingredient
    return await ctx.db.insert("ingredients", {
      name: args.name,
      categoryId: args.categoryId,
      defaultUnit: args.defaultUnit,
      spaceId: args.spaceId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update an ingredient
 */
export const updateIngredient = mutation({
  args: {
    id: v.id("ingredients"),
    name: v.optional(v.string()),
    categoryId: v.optional(v.id("ingredient_categories")),
    defaultUnit: v.optional(v.string()),
    caloriesPer100g: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const ingredient = await ctx.db.get(args.id);

    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    await requireSpaceAccess(ctx, ingredient.spaceId, identity.subject);

    const updates: Record<string, any> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
    if (args.defaultUnit !== undefined) updates.defaultUnit = args.defaultUnit;
    if (args.caloriesPer100g !== undefined)
      updates.caloriesPer100g = args.caloriesPer100g;

    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Delete an ingredient (and remove from all recipes)
 */
export const deleteIngredient = mutation({
  args: {
    id: v.id("ingredients"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const ingredient = await ctx.db.get(args.id);

    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    await requireSpaceAccess(ctx, ingredient.spaceId, identity.subject);

    // Remove this ingredient from all recipe_ingredients entries
    const recipeIngredients = await ctx.db
      .query("recipe_ingredients")
      .filter((q) => q.eq(q.field("ingredientId"), args.id))
      .collect();
    
    for (const ri of recipeIngredients) {
      await ctx.db.delete(ri._id);
    }

    // Delete the ingredient
    await ctx.db.delete(args.id);
  },
});

// ============================================
// RECIPES
// ============================================

/**
 * List recipes with optional filters
 */
export const list = query({
  args: {
    spaceId: v.id("spaces"),
    typeId: v.optional(v.id("recipe_types")),
    maxPrepTime: v.optional(v.number()),
    ingredientIds: v.optional(v.array(v.id("ingredients"))),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    let recipes = await ctx.db
      .query("recipes")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();

    // Filter by type
    if (args.typeId) {
      recipes = recipes.filter((r) => r.typeId === args.typeId);
    }

    // Filter by max prep time
    if (args.maxPrepTime) {
      recipes = recipes.filter(
        (r) => r.prepTimeMinutes && r.prepTimeMinutes <= args.maxPrepTime!
      );
    }

    // Filter by ingredients (recipes containing these ingredients)
    if (args.ingredientIds && args.ingredientIds.length > 0) {
      const recipeIngredients = await ctx.db
        .query("recipe_ingredients")
        .collect();

      const recipeIngredientMap = new Map<string, Set<string>>();
      for (const ri of recipeIngredients) {
        const recipeId = ri.recipeId as string;
        if (!recipeIngredientMap.has(recipeId)) {
          recipeIngredientMap.set(recipeId, new Set());
        }
        recipeIngredientMap.get(recipeId)!.add(ri.ingredientId as string);
      }

      const filterIngredientIds = new Set(args.ingredientIds.map((id) => id as string));
      recipes = recipes.filter((r) => {
        const recipeIngIds = recipeIngredientMap.get(r._id as string);
        if (!recipeIngIds) return false;
        // Recipe must contain at least one of the filter ingredients
        return Array.from(filterIngredientIds).some((id) => recipeIngIds.has(id));
      });
    }

    // Get types for display
    const types = await ctx.db
      .query("recipe_types")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    const typeMap = new Map(types.map((t) => [t._id, t]));

    // Sort by creation date (newest first)
    recipes.sort((a, b) => b.createdAt - a.createdAt);

    return recipes.map((r) => ({
      ...r,
      type: r.typeId ? typeMap.get(r.typeId) : null,
    }));
  },
});

/**
 * Get a single recipe with all ingredients
 */
export const getById = query({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const recipe = await ctx.db.get(args.id);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    await requireSpaceAccess(ctx, recipe.spaceId, identity.subject);

    // Get type
    const type = recipe.typeId ? await ctx.db.get(recipe.typeId) : null;

    // Get recipe ingredients with ingredient details
    const recipeIngredients = await ctx.db
      .query("recipe_ingredients")
      .withIndex("by_recipe", (q) => q.eq("recipeId", args.id))
      .collect();

    // Sort by order
    recipeIngredients.sort((a, b) => a.order - b.order);

    // Get ingredient details
    const ingredientIds = recipeIngredients.map((ri) => ri.ingredientId);
    const ingredients = await Promise.all(
      ingredientIds.map((id) => ctx.db.get(id))
    );
    const ingredientMap = new Map(
      ingredients.filter(Boolean).map((i) => [i!._id, i])
    );

    const ingredientsWithDetails = recipeIngredients.map((ri) => ({
      ...ri,
      ingredient: ingredientMap.get(ri.ingredientId),
    }));

    return {
      ...recipe,
      type,
      ingredients: ingredientsWithDetails,
    };
  },
});

/**
 * Get stats for home page
 */
export const getStats = query({
  args: { spaceId: v.optional(v.id("spaces")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (!args.spaceId) return null;

    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId!))
      .collect();

    const ingredients = await ctx.db
      .query("ingredients")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId!))
      .collect();

    return {
      recipeCount: recipes.length,
      ingredientCount: ingredients.length,
    };
  },
});

/**
 * Create a new recipe
 */
export const create = mutation({
  args: {
    name: v.string(),
    typeId: v.optional(v.id("recipe_types")),
    servings: v.number(),
    prepTimeMinutes: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    instructions: v.array(
      v.object({
        title: v.optional(v.string()),
        instruction: v.string(),
        note: v.optional(v.string()),
      })
    ),
    ingredients: v.array(
      v.object({
        ingredientId: v.id("ingredients"),
        quantity: v.number(),
        unit: v.string(),
        isOptional: v.boolean(),
      })
    ),
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireSpaceAccess(ctx, args.spaceId, identity.subject);

    // Create recipe
    const recipeId = await ctx.db.insert("recipes", {
      name: args.name,
      typeId: args.typeId,
      servings: args.servings,
      prepTimeMinutes: args.prepTimeMinutes,
      imageUrl: args.imageUrl,
      source: args.source,
      instructions: args.instructions,
      submittedBy: identity.subject,
      submittedByName: identity.name ?? identity.email ?? undefined,
      spaceId: args.spaceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create recipe ingredients
    for (let i = 0; i < args.ingredients.length; i++) {
      const ing = args.ingredients[i];
      await ctx.db.insert("recipe_ingredients", {
        recipeId,
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        unit: ing.unit,
        isOptional: ing.isOptional,
        order: i,
      });
    }

    return recipeId;
  },
});

/**
 * Update a recipe
 */
export const update = mutation({
  args: {
    id: v.id("recipes"),
    name: v.optional(v.string()),
    typeId: v.optional(v.id("recipe_types")),
    servings: v.optional(v.number()),
    prepTimeMinutes: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    instructions: v.optional(
      v.array(
        v.object({
          title: v.optional(v.string()),
          instruction: v.string(),
          note: v.optional(v.string()),
        })
      )
    ),
    ingredients: v.optional(
      v.array(
        v.object({
          ingredientId: v.id("ingredients"),
          quantity: v.number(),
          unit: v.string(),
          isOptional: v.boolean(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const recipe = await ctx.db.get(args.id);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    await requireSpaceAccess(ctx, recipe.spaceId, identity.subject);

    // Update recipe fields
    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.typeId !== undefined) updates.typeId = args.typeId;
    if (args.servings !== undefined) updates.servings = args.servings;
    if (args.prepTimeMinutes !== undefined)
      updates.prepTimeMinutes = args.prepTimeMinutes;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.source !== undefined) updates.source = args.source;
    if (args.instructions !== undefined)
      updates.instructions = args.instructions;

    await ctx.db.patch(args.id, updates);

    // Update ingredients if provided
    if (args.ingredients !== undefined) {
      // Delete existing recipe ingredients
      const existing = await ctx.db
        .query("recipe_ingredients")
        .withIndex("by_recipe", (q) => q.eq("recipeId", args.id))
        .collect();

      for (const ri of existing) {
        await ctx.db.delete(ri._id);
      }

      // Create new recipe ingredients
      for (let i = 0; i < args.ingredients.length; i++) {
        const ing = args.ingredients[i];
        await ctx.db.insert("recipe_ingredients", {
          recipeId: args.id,
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          isOptional: ing.isOptional,
          order: i,
        });
      }
    }
  },
});

/**
 * Delete a recipe
 */
export const deleteRecipe = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const recipe = await ctx.db.get(args.id);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Only admins or the submitter can delete
    const membership = await requireSpaceAccess(
      ctx,
      recipe.spaceId,
      identity.subject
    );
    const isAdmin = membership.role === "creator" || membership.role === "admin";
    const isSubmitter = recipe.submittedBy === identity.subject;

    if (!isAdmin && !isSubmitter) {
      throw new Error("You can only delete recipes you submitted");
    }

    // Delete recipe ingredients first
    const ingredients = await ctx.db
      .query("recipe_ingredients")
      .withIndex("by_recipe", (q) => q.eq("recipeId", args.id))
      .collect();

    for (const ing of ingredients) {
      await ctx.db.delete(ing._id);
    }

    // Delete the recipe
    await ctx.db.delete(args.id);
  },
});
