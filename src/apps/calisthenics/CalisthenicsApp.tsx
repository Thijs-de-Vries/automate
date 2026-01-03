import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

export default function CalisthenicsApp() {
  const [newExercise, setNewExercise] = useState('')
  const [newReps, setNewReps] = useState('')
  const exercises = useQuery(api.calisthenics.list) ?? []
  const createExercise = useMutation(api.calisthenics.create)
  const toggleExercise = useMutation(api.calisthenics.toggle)
  const removeExercise = useMutation(api.calisthenics.remove)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExercise.trim()) return
    await createExercise({ exercise: newExercise.trim(), reps: Number(newReps) })
    setNewExercise('')
    setNewReps('')
  }

  const completedCount = exercises.filter((t) => t.isCompleted).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Exercises</h2>
        <span className="text-sm text-slate-400">
          {completedCount}/{exercises.length} done
        </span>
      </div>

      {/* Add exercise form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
          placeholder="Add the name of the exercise..."
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
        />
        <input
          type="number"
          value={newReps}
          onChange={(e) => setNewReps(e.target.value)}
          placeholder="Add the number of reps..."
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!newExercise.trim() || !newReps.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </form>

      {/* Exercise list */}
      <ul className="space-y-2">
        {exercises.length === 0 ? (
          <li className="text-center py-8 text-slate-500">
            No exercises yet. Add one above!
          </li>
        ) : (
          exercises.map((exercise) => (
            <li
              key={exercise._id}
              className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg group"
            >
              <button
                onClick={() => toggleExercise({ id: exercise._id })}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  exercise.isCompleted
                    ? 'bg-green-600 border-green-600'
                    : 'border-slate-500 hover:border-blue-500'
                }`}
              >
                {exercise.isCompleted && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
              <span
                className={`flex-1 ${
                  exercise.isCompleted ? 'line-through text-slate-500' : ''
                }`}
              >
                {exercise.exercise} - {exercise.reps} reps
              </span>
              <button
                onClick={() => removeExercise({ id: exercise._id })}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
