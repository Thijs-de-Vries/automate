import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useActiveSpaceId } from '@/contexts/SpaceContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dumbbell, Trash2, Plus, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CalisthenicsApp() {
  const [newExercise, setNewExercise] = useState('')
  const [newReps, setNewReps] = useState('')
  const activeSpaceId = useActiveSpaceId()
  
  const exercises = useQuery(
    api.calisthenics.list,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  ) ?? []
  const createExercise = useMutation(api.calisthenics.create)
  const toggleExercise = useMutation(api.calisthenics.toggle)
  const removeExercise = useMutation(api.calisthenics.remove)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExercise.trim() || !activeSpaceId) return
    await createExercise({ 
      exercise: newExercise.trim(), 
      reps: Number(newReps),
      spaceId: activeSpaceId,
    })
    setNewExercise('')
    setNewReps('')
  }

  const completedCount = exercises.filter((t) => t.isCompleted).length

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exercises</h2>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {completedCount} of {exercises.length} completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
            {exercises.reduce((sum, ex) => sum + (ex.isCompleted ? ex.reps : 0), 0)}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>reps done</p>
        </div>
      </div>

      {/* Add exercise form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
          placeholder="Exercise name..."
          className="flex-1 px-4 py-3 rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <input
          type="number"
          value={newReps}
          onChange={(e) => setNewReps(e.target.value)}
          placeholder="Reps"
          className="w-24 px-4 py-3 rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <Button
          type="submit"
          disabled={!newExercise.trim() || !newReps.trim()}
        >
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      {/* Exercise list */}
      <div className="space-y-2">
        {exercises.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'var(--primary-muted)' }}>
                <Dumbbell className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium">No exercises yet</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Add your first exercise above to get started
                </p>
              </div>
            </div>
          </Card>
        ) : (
          exercises.map((exercise) => (
            <Card
              key={exercise._id}
              className="p-4 flex items-center gap-3 group transition-all hover:scale-[1.01]"
            >
              <button
                onClick={() => toggleExercise({ id: exercise._id })}
                className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                  exercise.isCompleted
                    ? "border-[var(--success)] bg-[var(--success)]"
                    : "border-[var(--border)] hover:border-[var(--primary)]"
                )}
              >
                {exercise.isCompleted && (
                  <CheckSquare className="w-4 h-4 text-white" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 transition-all",
                  exercise.isCompleted && "line-through opacity-50"
                )}
              >
                {exercise.exercise}
              </span>
              <span
                className={cn(
                  "px-3 py-1 rounded-lg text-sm font-medium",
                  exercise.isCompleted && "opacity-50"
                )}
                style={{
                  backgroundColor: 'var(--primary-muted)',
                  color: 'var(--primary)',
                }}
              >
                {exercise.reps} reps
              </span>
              <button
                onClick={() => removeExercise({ id: exercise._id })}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all hover:bg-[var(--destructive-muted)]"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--destructive)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
