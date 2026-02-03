import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useActiveSpaceId } from '@/contexts/SpaceContext'
import type { Id, Doc } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  UtensilsCrossed,
  Plus,
  X,
  Clock,
  Users,
  ChevronLeft,
  Trash2,
  Edit2,
  SlidersHorizontal,
  Link as LinkIcon,
  Minus,
  Check,
  AlertCircle,
  Carrot,
  Save,
} from 'lucide-react'

type Recipe = Doc<"recipes"> & {
  type?: { _id: Id<"recipe_types">; name: string } | null
}

type RecipeWithIngredients = Recipe & {
  ingredients: Array<{
    _id: Id<"recipe_ingredients">
    recipeId: Id<"recipes">
    ingredientId: Id<"ingredients">
    quantity: number
    unit: string
    isOptional: boolean
    order: number
    ingredient?: Doc<"ingredients">
  }>
}

type Ingredient = Doc<"ingredients"> & {
  category?: Doc<"ingredient_categories"> | null
}

type RecipeType = Doc<"recipe_types">

// ============================================
// Main App Component
// ============================================
export default function RecipesApp() {
  const activeSpaceId = useActiveSpaceId()
  const [currentView, setCurrentView] = useState<'recipes' | 'ingredients'>('recipes')
  const [selectedRecipeId, setSelectedRecipeId] = useState<Id<"recipes"> | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  // Filters
  const [typeFilter, setTypeFilter] = useState<Id<"recipe_types"> | null>(null)
  const [maxPrepTimeFilter, setMaxPrepTimeFilter] = useState<number | null>(null)
  const [ingredientFilter, setIngredientFilter] = useState<Id<"ingredients">[]>([])

  const recipes = useQuery(
    api.recipes.list,
    activeSpaceId
      ? {
          spaceId: activeSpaceId,
          typeId: typeFilter ?? undefined,
          maxPrepTime: maxPrepTimeFilter ?? undefined,
          ingredientIds: ingredientFilter.length > 0 ? ingredientFilter : undefined,
        }
      : 'skip'
  ) ?? []

  const types = useQuery(
    api.recipes.listTypes,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  ) ?? []

  const ingredients = useQuery(
    api.recipes.listIngredients,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  ) ?? []

  const hasFilters = typeFilter !== null || maxPrepTimeFilter !== null || ingredientFilter.length > 0

  const clearFilters = () => {
    setTypeFilter(null)
    setMaxPrepTimeFilter(null)
    setIngredientFilter([])
  }

  if (!activeSpaceId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary-muted)' }}
              >
                <UtensilsCrossed className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium">Select a space</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Choose a space to view recipes
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // If a recipe is selected, show detail view
  if (selectedRecipeId) {
    return (
      <RecipeDetailView
        recipeId={selectedRecipeId}
        onBack={() => setSelectedRecipeId(null)}
      />
    )
  }

  // If showing ingredients manager
  if (currentView === 'ingredients') {
    return (
      <IngredientsManager
        spaceId={activeSpaceId}
        ingredients={ingredients}
        onBack={() => setCurrentView('recipes')}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">Recipes</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-1">
                <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Family recipe collection
                </p>
                {hasFilters && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--primary)' }}
                    >
                      Filtered
                    </span>
                    <button
                      onClick={clearFilters}
                      className="text-xs underline"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button onClick={() => setCurrentView('ingredients')} variant="outline" className="gap-1 sm:gap-2" size="sm">
                <Carrot className="w-4 h-4" />
                <span className="hidden sm:inline">Ingredients</span>
              </Button>
              <Button onClick={() => setShowFilterMenu(true)} variant="outline" className="gap-1 sm:gap-2" size="sm">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
              <Button onClick={() => setShowAddModal(true)} className="gap-1 sm:gap-2" size="sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Recipe</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {recipes.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary-muted)' }}
                >
                  <UtensilsCrossed className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="font-medium">No recipes yet</p>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {hasFilters ? 'No recipes match your filters' : 'Add your first recipe to get started'}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            recipes.map((recipe) => (
              <RecipeCard key={recipe._id} recipe={recipe} onSelect={() => setSelectedRecipeId(recipe._id)} />
            ))
          )}
        </div>
      </div>

      {/* Filter Menu */}
      {showFilterMenu && (
        <FilterMenu
          types={types}
          ingredients={ingredients}
          typeFilter={typeFilter}
          maxPrepTimeFilter={maxPrepTimeFilter}
          ingredientFilter={ingredientFilter}
          onTypeChange={setTypeFilter}
          onMaxPrepTimeChange={setMaxPrepTimeFilter}
          onIngredientChange={setIngredientFilter}
          onClose={() => setShowFilterMenu(false)}
          onClear={clearFilters}
        />
      )}

      {/* Add Recipe Modal */}
      {showAddModal && activeSpaceId && (
        <RecipeFormModal spaceId={activeSpaceId} onClose={() => setShowAddModal(false)} />
      )}

      {/* Edit Recipe Modal */}
      {showEditModal && selectedRecipeId && activeSpaceId && (
        <RecipeFormModal
          spaceId={activeSpaceId}
          recipeId={selectedRecipeId}
          onClose={() => {
            setShowEditModal(false)
          }}
        />
      )}
    </div>
  )
}

// ============================================
// Recipe Card Component
// ============================================
function RecipeCard({ recipe, onSelect }: { recipe: Recipe; onSelect: () => void }) {
  return (
    <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onSelect}>
      <div className="flex gap-3 sm:gap-4">
        {/* Image */}
        {recipe.imageUrl && (
          <div className="flex-shrink-0">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg truncate">{recipe.name}</h3>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {recipe.type && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--primary)' }}
                  >
                    {recipe.type.name}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  <Users className="w-3 h-3" />
                  {recipe.servings}
                </div>
                {recipe.prepTimeMinutes && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <Clock className="w-3 h-3" />
                    {recipe.prepTimeMinutes} min
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>by {recipe.submittedByName || 'Unknown'}</span>
            <span>•</span>
            <span>{recipe.instructions.length} steps</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ============================================
// Recipe Detail View
// ============================================
function RecipeDetailView({
  recipeId,
  onBack,
}: {
  recipeId: Id<"recipes">
  onBack: () => void
}) {
  const recipe = useQuery(api.recipes.getById, { id: recipeId }) as RecipeWithIngredients | undefined
  const deleteRecipe = useMutation(api.recipes.deleteRecipe)
  const [scaledServings, setScaledServings] = useState<number | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  if (!recipe) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <p>Loading recipe...</p>
        </Card>
      </div>
    )
  }

  const servings = scaledServings ?? recipe.servings
  const scaleFactor = servings / recipe.servings

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) return
    try {
      await deleteRecipe({ id: recipeId })
      onBack()
    } catch (error) {
      console.error('Failed to delete recipe:', error)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                title="Edit recipe"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                title="Delete recipe"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Banner Image */}
        {recipe.imageUrl && (
          <div className="w-full h-48 sm:h-64">
            <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
          {/* Title & Meta */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{recipe.name}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {recipe.type && (
                <span
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--primary)' }}
                >
                  {recipe.type.name}
                </span>
              )}
              {recipe.prepTimeMinutes && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {recipe.prepTimeMinutes} min
                </div>
              )}
              <span>by {recipe.submittedByName || 'Unknown'}</span>
            </div>
            {recipe.source && (
              <div className="mt-2 flex items-center gap-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <LinkIcon className="w-4 h-4" />
                {recipe.source.startsWith('http') ? (
                  <a
                    href={recipe.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Source
                  </a>
                ) : (
                  <span>{recipe.source}</span>
                )}
              </div>
            )}
          </div>

          {/* Servings Scaler */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                <span className="font-medium">Servings</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScaledServings(Math.max(1, servings - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-semibold">{servings}</span>
                <button
                  onClick={() => setScaledServings(servings + 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setScaledServings(null)}
                  className={`text-xs underline ml-2 ${scaledServings !== null && scaledServings !== recipe.servings ? 'visible' : 'invisible'}`}
                  style={{ color: 'var(--muted-foreground)' }}
                  disabled={scaledServings === null || scaledServings === recipe.servings}
                >
                  Reset
                </button>
              </div>
            </div>
          </Card>

          {/* Ingredients */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Ingredients</h2>
            <Card className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {recipe.ingredients.map((ri) => (
                <div key={ri._id} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <span className="font-medium">
                      {formatQuantity(ri.quantity * scaleFactor)} {ri.unit}
                    </span>{' '}
                    <span>{ri.ingredient?.name || 'Unknown ingredient'}</span>
                    {ri.isOptional && (
                      <span className="text-xs ml-2" style={{ color: 'var(--muted-foreground)' }}>
                        (optional)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Instructions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Instructions</h2>
            <div className="space-y-4">
              {recipe.instructions.map((step, index) => (
                <Card key={index} className="p-4">
                  <div className="flex gap-4">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold"
                      style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      {step.title && <h3 className="font-medium mb-1">{step.title}</h3>}
                      <p style={{ color: step.title ? 'var(--muted-foreground)' : 'inherit' }}>{step.instruction}</p>
                      {step.note && (
                        <p className="mt-2 text-sm italic" style={{ color: 'var(--muted-foreground)' }}>
                          💡 {step.note}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && recipe && (
        <RecipeFormModal
          spaceId={recipe.spaceId}
          recipeId={recipe._id}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  )
}

// ============================================
// Recipe Form Modal (Add/Edit)
// ============================================
function RecipeFormModal({
  spaceId,
  recipeId,
  onClose,
}: {
  spaceId: Id<"spaces">
  recipeId?: Id<"recipes">
  onClose: () => void
}) {
  const isEditing = !!recipeId
  const existingRecipe = useQuery(
    api.recipes.getById,
    recipeId ? { id: recipeId } : 'skip'
  ) as RecipeWithIngredients | undefined

  const types = useQuery(api.recipes.listTypes, { spaceId }) ?? []
  const allIngredients = useQuery(api.recipes.listIngredients, { spaceId }) ?? []

  const createRecipe = useMutation(api.recipes.create)
  const updateRecipe = useMutation(api.recipes.update)
  const upsertType = useMutation(api.recipes.upsertType)
  const upsertIngredient = useMutation(api.recipes.upsertIngredient)
  const upsertCategory = useMutation(api.recipes.upsertCategory)

  // Form state
  const [name, setName] = useState('')
  const [typeInput, setTypeInput] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState<Id<"recipe_types"> | null>(null)
  const [servings, setServings] = useState('4')
  const [prepTime, setPrepTime] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [source, setSource] = useState('')

  // Ingredients state
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{
      ingredientId: Id<"ingredients"> | null
      ingredientName: string
      quantity: string
      unit: string
      isOptional: boolean
      categoryInput: string
      selectedCategoryId: Id<"ingredient_categories"> | null
    }>
  >([])

  // Instructions state
  const [instructions, setInstructions] = useState<
    Array<{ title: string; instruction: string; note: string }>
  >([{ title: '', instruction: '', note: '' }])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTypeConfirm, setShowTypeConfirm] = useState(false)
  const [pendingNewType, setPendingNewType] = useState('')

  // Initialize form with existing recipe data
  useEffect(() => {
    if (existingRecipe && isEditing) {
      setName(existingRecipe.name)
      setSelectedTypeId(existingRecipe.typeId ?? null)
      setTypeInput(existingRecipe.type?.name ?? '')
      setServings(existingRecipe.servings.toString())
      setPrepTime(existingRecipe.prepTimeMinutes?.toString() ?? '')
      setImageUrl(existingRecipe.imageUrl ?? '')
      setSource(existingRecipe.source ?? '')
      setInstructions(
        existingRecipe.instructions.map((i) => ({
          title: i.title ?? '',
          instruction: i.instruction,
          note: i.note ?? '',
        }))
      )
      setRecipeIngredients(
        existingRecipe.ingredients.map((ri) => ({
          ingredientId: ri.ingredientId,
          ingredientName: ri.ingredient?.name ?? '',
          quantity: ri.quantity.toString(),
          unit: ri.unit,
          isOptional: ri.isOptional,
          categoryInput: '',
          selectedCategoryId: null,
        }))
      )
    }
  }, [existingRecipe, isEditing])

  // Check if type exists
  const typeExists = types.some((t) => t.name.toLowerCase() === typeInput.toLowerCase())
  const matchingType = types.find((t) => t.name.toLowerCase() === typeInput.toLowerCase())

  // Handle type input blur - verify new type
  const handleTypeBlur = () => {
    if (typeInput.trim() && !typeExists && !selectedTypeId) {
      setPendingNewType(typeInput.trim())
      setShowTypeConfirm(true)
    } else if (matchingType) {
      setSelectedTypeId(matchingType._id)
    }
  }

  const handleConfirmNewType = async () => {
    const typeId = await upsertType({ name: pendingNewType, spaceId })
    setSelectedTypeId(typeId)
    setShowTypeConfirm(false)
    setPendingNewType('')
  }

  const handleRejectNewType = () => {
    setTypeInput('')
    setSelectedTypeId(null)
    setShowTypeConfirm(false)
    setPendingNewType('')
  }

  // Add ingredient row
  const addIngredientRow = () => {
    setRecipeIngredients([
      ...recipeIngredients,
      {
        ingredientId: null,
        ingredientName: '',
        quantity: '',
        unit: '',
        isOptional: false,
        categoryInput: '',
        selectedCategoryId: null,
      },
    ])
  }

  // Remove ingredient row
  const removeIngredientRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index))
  }

  // Update ingredient row
  const updateIngredientRow = (index: number, updates: Partial<(typeof recipeIngredients)[0]>) => {
    setRecipeIngredients(
      recipeIngredients.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
    )
  }

  // Add instruction step
  const addInstructionStep = () => {
    setInstructions([...instructions, { title: '', instruction: '', note: '' }])
  }

  // Remove instruction step
  const removeInstructionStep = (index: number) => {
    if (instructions.length > 1) {
      setInstructions(instructions.filter((_, i) => i !== index))
    }
  }

  // Update instruction step
  const updateInstructionStep = (index: number, updates: Partial<(typeof instructions)[0]>) => {
    setInstructions(instructions.map((step, i) => (i === index ? { ...step, ...updates } : step)))
  }

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || recipeIngredients.length === 0) return

    setIsSubmitting(true)
    try {
      // Resolve or create ingredients
      const resolvedIngredients: Array<{
        ingredientId: Id<"ingredients">
        quantity: number
        unit: string
        isOptional: boolean
      }> = []

      for (const ing of recipeIngredients) {
        if (!ing.ingredientName.trim() || !ing.quantity) continue

        let ingredientId = ing.ingredientId

        // If no ingredientId, try to find or create
        if (!ingredientId) {
          // Check if ingredient with this name exists
          const existing = allIngredients.find(
            (i) => i.name.toLowerCase() === ing.ingredientName.toLowerCase()
          )
          if (existing) {
            ingredientId = existing._id
          } else {
            // Create category if needed
            let categoryId = ing.selectedCategoryId
            if (!categoryId && ing.categoryInput.trim()) {
              categoryId = await upsertCategory({ name: ing.categoryInput.trim(), spaceId })
            }
            // Create ingredient
            ingredientId = await upsertIngredient({
              name: ing.ingredientName.trim(),
              spaceId,
              categoryId: categoryId ?? undefined,
              defaultUnit: ing.unit || undefined,
            })
          }
        }

        if (ingredientId) {
          resolvedIngredients.push({
            ingredientId,
            quantity: parseFloat(ing.quantity) || 0,
            unit: ing.unit,
            isOptional: ing.isOptional,
          })
        }
      }

      // Resolve or create type
      let typeId = selectedTypeId
      if (!typeId && typeInput.trim()) {
        typeId = await upsertType({ name: typeInput.trim(), spaceId })
      }

      const validInstructions = instructions
        .filter((s) => s.instruction.trim())
        .map((s) => ({
          title: s.title.trim() || undefined,
          instruction: s.instruction.trim(),
          note: s.note.trim() || undefined,
        }))

      if (isEditing && recipeId) {
        await updateRecipe({
          id: recipeId,
          name: name.trim(),
          typeId: typeId ?? undefined,
          servings: parseInt(servings) || 4,
          prepTimeMinutes: prepTime ? parseInt(prepTime) : undefined,
          imageUrl: imageUrl.trim() || undefined,
          source: source.trim() || undefined,
          instructions: validInstructions,
          ingredients: resolvedIngredients,
        })
      } else {
        await createRecipe({
          name: name.trim(),
          typeId: typeId ?? undefined,
          servings: parseInt(servings) || 4,
          prepTimeMinutes: prepTime ? parseInt(prepTime) : undefined,
          imageUrl: imageUrl.trim() || undefined,
          source: source.trim() || undefined,
          instructions: validInstructions,
          ingredients: resolvedIngredients,
          spaceId,
        })
      }

      onClose()
    } catch (error) {
      console.error('Failed to save recipe:', error)
      alert('Failed to save recipe. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-4 sm:p-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold">
                {isEditing ? 'Edit Recipe' : 'Add Recipe'}
              </h2>
              <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-4 sm:p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Recipe Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Grandma's Spaghetti Bolognese"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Type with autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <TypeAutocomplete
                    value={typeInput}
                    onChange={(value) => {
                      setTypeInput(value)
                      // Clear selection if input changes
                      if (matchingType?.name !== value) {
                        setSelectedTypeId(null)
                      }
                    }}
                    onBlur={handleTypeBlur}
                    onSelect={(type) => {
                      setTypeInput(type.name)
                      setSelectedTypeId(type._id)
                    }}
                    types={types}
                    placeholder="e.g., Pizza, Pasta, Salad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Servings <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Prep Time (minutes)</label>
                  <Input
                    type="number"
                    min="0"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Source</label>
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="URL or 'Grandma'"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/recipe-image.jpg"
                />
              </div>
            </div>

            {/* Ingredients Section */}
            <div>
              <div className="mb-3">
                <label className="text-sm font-medium">
                  Ingredients <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="space-y-3">
                {recipeIngredients.map((ing, index) => (
                  <IngredientRow
                    key={index}
                    ingredient={ing}
                    allIngredients={allIngredients}
                    onUpdate={(updates) => updateIngredientRow(index, updates)}
                    onRemove={() => removeIngredientRow(index)}
                  />
                ))}
                {recipeIngredients.length === 0 && (
                  <div
                    className="p-4 rounded-lg text-center text-sm"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--muted-foreground)' }}
                  >
                    Click "Add Ingredient" to add ingredients
                  </div>
                )}
                <Button type="button" variant="outline" onClick={addIngredientRow} className="w-full mt-3">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>
            </div>

            {/* Instructions Section */}
            <div>
              <div className="mb-3">
                <label className="text-sm font-medium">Instructions</label>
              </div>
              <div className="space-y-4">
                {instructions.map((step, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"
                        style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={step.title}
                          onChange={(e) => updateInstructionStep(index, { title: e.target.value })}
                          placeholder="Step title (optional)"
                        />
                        <textarea
                          value={step.instruction}
                          onChange={(e) =>
                            updateInstructionStep(index, { instruction: e.target.value })
                          }
                          placeholder="Describe what to do..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border resize-none text-sm"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                        />
                        <Input
                          value={step.note}
                          onChange={(e) => updateInstructionStep(index, { note: e.target.value })}
                          placeholder="💡 Optional tip or note"
                          className="text-sm"
                        />
                      </div>
                      {instructions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInstructionStep(index)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
                <Button type="button" variant="outline" onClick={addInstructionStep} className="w-full mt-4">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Step
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="p-4 sm:p-6 border-t flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || recipeIngredients.length === 0 || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Recipe'}
            </Button>
          </div>
        </form>

        {/* New Type Confirmation Dialog */}
        {showTypeConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <Card className="p-6 max-w-sm w-full">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Create new type?</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    "{pendingNewType}" doesn't exist yet. Create it?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleRejectNewType}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmNewType}>
                  <Check className="w-4 h-4 mr-1" />
                  Create
                </Button>
              </div>
            </Card>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================
// Type Autocomplete Component
// ============================================
function TypeAutocomplete({
  value,
  onChange,
  onBlur,
  onSelect,
  types,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onSelect: (type: RecipeType) => void
  types: RecipeType[]
  placeholder: string
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredTypes = value
    ? types.filter((t) => t.name.toLowerCase().includes(value.toLowerCase()))
    : types

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => {
          setTimeout(() => {
            setShowDropdown(false)
            onBlur()
          }, 150)
        }}
        placeholder={placeholder}
      />
      {showDropdown && filteredTypes.length > 0 && (
        <div
          className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto rounded-lg shadow-lg"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {filteredTypes.map((type) => (
            <button
              key={type._id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(type)
                setShowDropdown(false)
              }}
            >
              {type.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Ingredient Row Component
// ============================================
function IngredientRow({
  ingredient,
  allIngredients,
  onUpdate,
  onRemove,
}: {
  ingredient: {
    ingredientId: Id<"ingredients"> | null
    ingredientName: string
    quantity: string
    unit: string
    isOptional: boolean
    categoryInput: string
    selectedCategoryId: Id<"ingredient_categories"> | null
  }
  allIngredients: Ingredient[]
  onUpdate: (updates: Partial<typeof ingredient>) => void
  onRemove: () => void
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNewIngredientFields, setShowNewIngredientFields] = useState(false)

  const matchingIngredient = allIngredients.find(
    (i) => i.name.toLowerCase() === ingredient.ingredientName.toLowerCase()
  )

  const filteredIngredients = ingredient.ingredientName
    ? allIngredients.filter((i) =>
        i.name.toLowerCase().includes(ingredient.ingredientName.toLowerCase())
      )
    : allIngredients

  const handleIngredientBlur = () => {
    setTimeout(() => {
      setShowDropdown(false)
      // If name doesn't match an existing ingredient, show new ingredient fields
      if (ingredient.ingredientName && !matchingIngredient && !ingredient.ingredientId) {
        setShowNewIngredientFields(true)
      }
    }, 150)
  }

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-start">
          {/* Quantity */}
          <div className="w-20">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={ingredient.quantity}
              onChange={(e) => onUpdate({ quantity: e.target.value })}
              placeholder="Qty"
            />
          </div>

          {/* Unit */}
          <div className="w-20">
            <Input
              value={ingredient.unit}
              onChange={(e) => onUpdate({ unit: e.target.value })}
              placeholder="Unit"
            />
          </div>

          {/* Ingredient Name with autocomplete */}
          <div className="flex-1 relative">
            <Input
              value={ingredient.ingredientName}
              onChange={(e) => {
                onUpdate({
                  ingredientName: e.target.value,
                  ingredientId: null,
                })
                setShowDropdown(true)
                setShowNewIngredientFields(false)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={handleIngredientBlur}
              placeholder="Ingredient name"
            />
            {showDropdown && filteredIngredients.length > 0 && (
              <div
                className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto rounded-lg shadow-lg"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {filteredIngredients.map((ing) => (
                  <button
                    key={ing._id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onUpdate({
                        ingredientId: ing._id,
                        ingredientName: ing.name,
                        unit: ingredient.unit || ing.defaultUnit || '',
                      })
                      setShowDropdown(false)
                      setShowNewIngredientFields(false)
                    }}
                  >
                    <span>{ing.name}</span>
                    {ing.category && (
                      <span
                        className="text-xs ml-2"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        ({ing.category.name})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional toggle */}
          <button
            type="button"
            onClick={() => onUpdate({ isOptional: !ingredient.isOptional })}
            className={`px-2 py-2 rounded text-xs ${
              ingredient.isOptional ? 'bg-amber-100 text-amber-700' : ''
            }`}
            style={
              !ingredient.isOptional
                ? { backgroundColor: 'var(--surface)', color: 'var(--muted-foreground)' }
                : undefined
            }
            title={ingredient.isOptional ? 'Optional' : 'Required'}
          >
            {ingredient.isOptional ? 'Opt' : 'Req'}
          </button>

          {/* Remove button */}
          <button
            type="button"
            onClick={onRemove}
            className="p-2 hover:bg-red-100 rounded text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New ingredient category (shown when creating new ingredient) */}
        {showNewIngredientFields && !matchingIngredient && (
          <div className="flex gap-2 items-center pl-[168px]">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              New ingredient:
            </span>
            <Input
              value={ingredient.categoryInput}
              onChange={(e) => onUpdate({ categoryInput: e.target.value })}
              placeholder="Category (e.g., Produce)"
              className="flex-1 text-sm"
            />
          </div>
        )}
      </div>
    </Card>
  )
}

// ============================================
// Ingredients Manager
// ============================================
function IngredientsManager({
  spaceId,
  ingredients,
  onBack,
}: {
  spaceId: Id<"spaces">
  ingredients: Ingredient[]
  onBack: () => void
}) {
  const categories = useQuery(api.recipes.listCategories, { spaceId })
  const updateIngredient = useMutation(api.recipes.updateIngredient)
  const deleteIngredient = useMutation(api.recipes.deleteIngredient)
  const upsertCategory = useMutation(api.recipes.upsertCategory)

  const [editingId, setEditingId] = useState<Id<"ingredients"> | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editCalories, setEditCalories] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredIngredients = searchQuery
    ? ingredients.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : ingredients

  // Group by category
  const grouped = filteredIngredients.reduce((acc, ing) => {
    const cat = categories?.find((c) => c._id === ing.categoryId)?.name || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(ing)
    return acc
  }, {} as Record<string, Ingredient[]>)

  const startEdit = (ing: Ingredient) => {
    const cat = categories?.find((c) => c._id === ing.categoryId)?.name || ''
    setEditingId(ing._id)
    setEditName(ing.name)
    setEditCategory(cat)
    setEditUnit(ing.defaultUnit || '')
    setEditCalories(ing.caloriesPer100g?.toString() || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditCategory('')
    setEditUnit('')
    setEditCalories('')
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    setSaving(true)
    try {
      let categoryId: Id<"ingredient_categories"> | undefined
      if (editCategory.trim()) {
        categoryId = await upsertCategory({ spaceId, name: editCategory.trim() })
      }
      await updateIngredient({
        id: editingId,
        name: editName.trim(),
        categoryId,
        defaultUnit: editUnit.trim() || undefined,
        caloriesPer100g: editCalories ? parseFloat(editCalories) : undefined,
      })
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: Id<"ingredients">) => {
    if (!confirm('Delete this ingredient? It will be removed from all recipes using it.')) return
    await deleteIngredient({ id })
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">Ingredients</h1>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {ingredients.length} ingredients
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredients..."
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, ings]) => (
            <div key={category} className="mb-6">
              <h2
                className="text-sm font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {category}
              </h2>
              <div className="space-y-2">
                {ings.map((ing) => (
                  <div
                    key={ing._id}
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                  >
                    {editingId === ing._id ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Ingredient name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            placeholder="Category"
                          />
                          <Input
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            placeholder="Default unit (g, ml...)"
                          />
                        </div>
                        <Input
                          type="number"
                          value={editCalories}
                          onChange={(e) => setEditCalories(e.target.value)}
                          placeholder="Calories per unit"
                        />
                        <div className="flex gap-2">
                          <Button onClick={saveEdit} disabled={saving || !editName.trim()} size="sm" className="flex-1">
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button onClick={cancelEdit} variant="outline" size="sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{ing.name}</div>
                          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {[
                              ing.defaultUnit && `Unit: ${ing.defaultUnit}`,
                              ing.caloriesPer100g && `${ing.caloriesPer100g} cal/100g`,
                            ]
                              .filter(Boolean)
                              .join(' • ') || 'No details'}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(ing)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ing._id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        {filteredIngredients.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
            {searchQuery ? 'No ingredients match your search' : 'No ingredients yet. Add some when creating recipes!'}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Filter Menu
// ============================================
function FilterMenu({
  types,
  ingredients,
  typeFilter,
  maxPrepTimeFilter,
  ingredientFilter,
  onTypeChange,
  onMaxPrepTimeChange,
  onIngredientChange,
  onClose,
  onClear,
}: {
  types: RecipeType[]
  ingredients: Ingredient[]
  typeFilter: Id<"recipe_types"> | null
  maxPrepTimeFilter: number | null
  ingredientFilter: Id<"ingredients">[]
  onTypeChange: (typeId: Id<"recipe_types"> | null) => void
  onMaxPrepTimeChange: (time: number | null) => void
  onIngredientChange: (ids: Id<"ingredients">[]) => void
  onClose: () => void
  onClear: () => void
}) {
  const [ingredientSearch, setIngredientSearch] = useState('')

  const filteredIngredients = ingredientSearch
    ? ingredients.filter((i) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
    : ingredients

  const hasFilters = typeFilter !== null || maxPrepTimeFilter !== null || ingredientFilter.length > 0

  const toggleIngredientFilter = (id: Id<"ingredients">) => {
    if (ingredientFilter.includes(id)) {
      onIngredientChange(ingredientFilter.filter((i) => i !== id))
    } else {
      onIngredientChange([...ingredientFilter, id])
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Filter Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full sm:w-80 z-50 shadow-2xl overflow-y-auto"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 border-b p-4"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Filters</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {hasFilters && (
            <button onClick={onClear} className="text-sm mt-2 underline" style={{ color: 'var(--primary)' }}>
              Clear all filters
            </button>
          )}
        </div>

        {/* Filter Sections */}
        <div className="p-4 space-y-6">
          {/* Type Section */}
          <div>
            <h3
              className="font-semibold mb-3 text-sm uppercase tracking-wide"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Type
            </h3>
            <div className="space-y-2">
              <FilterOption
                label="All Types"
                selected={typeFilter === null}
                onClick={() => onTypeChange(null)}
              />
              {types.map((type) => (
                <FilterOption
                  key={type._id}
                  label={type.name}
                  selected={typeFilter === type._id}
                  onClick={() => onTypeChange(type._id)}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

          {/* Prep Time Section */}
          <div>
            <h3
              className="font-semibold mb-3 text-sm uppercase tracking-wide"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Max Prep Time
            </h3>
            <div className="space-y-2">
              <FilterOption
                label="Any time"
                selected={maxPrepTimeFilter === null}
                onClick={() => onMaxPrepTimeChange(null)}
              />
              <FilterOption
                label="15 minutes or less"
                selected={maxPrepTimeFilter === 15}
                onClick={() => onMaxPrepTimeChange(15)}
              />
              <FilterOption
                label="30 minutes or less"
                selected={maxPrepTimeFilter === 30}
                onClick={() => onMaxPrepTimeChange(30)}
              />
              <FilterOption
                label="1 hour or less"
                selected={maxPrepTimeFilter === 60}
                onClick={() => onMaxPrepTimeChange(60)}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

          {/* Ingredients Section */}
          <div>
            <h3
              className="font-semibold mb-3 text-sm uppercase tracking-wide"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Has Ingredients
            </h3>
            <Input
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              placeholder="Search ingredients..."
              className="mb-3"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredIngredients.map((ing) => (
                <FilterOption
                  key={ing._id}
                  label={ing.name}
                  selected={ingredientFilter.includes(ing._id)}
                  onClick={() => toggleIngredientFilter(ing._id)}
                />
              ))}
              {filteredIngredients.length === 0 && (
                <p className="text-sm text-center py-2" style={{ color: 'var(--muted-foreground)' }}>
                  No ingredients found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 border-t p-4"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
        >
          <Button onClick={onClose} className="w-full">
            Show Results
          </Button>
        </div>
      </div>
    </>
  )
}

// ============================================
// Filter Option Component
// ============================================
function FilterOption({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
      style={{
        backgroundColor: selected ? 'var(--primary-muted)' : 'transparent',
      }}
    >
      <span className={selected ? 'font-medium' : ''} style={{ color: selected ? 'var(--primary)' : 'inherit' }}>
        {label}
      </span>
      {selected && <Check className="w-4 h-4" style={{ color: 'var(--primary)' }} />}
    </button>
  )
}

// ============================================
// Utility Functions
// ============================================
function formatQuantity(num: number): string {
  // Format nicely - remove trailing zeros
  if (Number.isInteger(num)) return num.toString()
  return num.toFixed(2).replace(/\.?0+$/, '')
}
