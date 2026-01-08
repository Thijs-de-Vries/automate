import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useActiveSpaceId } from '@/contexts/SpaceContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CheckSquare, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TasksApp() {
  const [newTask, setNewTask] = useState('')
  const activeSpaceId = useActiveSpaceId()
  
  const tasks = useQuery(
    api.tasks.list,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  ) ?? []
  const createTask = useMutation(api.tasks.create)
  const toggleTask = useMutation(api.tasks.toggle)
  const removeTask = useMutation(api.tasks.remove)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.trim() || !activeSpaceId) return
    await createTask({ 
      text: newTask.trim(),
      spaceId: activeSpaceId,
    })
    setNewTask('')
  }

  const completedCount = tasks.filter((t) => t.isCompleted).length

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {completedCount} of {tasks.length} completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
            {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>progress</p>
        </div>
      </div>

      {/* Add task form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-3 rounded-xl border transition-colors"
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
          disabled={!newTask.trim()}
          className="px-4"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                   style={{ backgroundColor: 'var(--primary-muted)' }}>
                <CheckSquare className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium">No tasks yet</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Add your first task above to get started
                </p>
              </div>
            </div>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task._id}
              className="p-4 flex items-center gap-3 group transition-all hover:scale-[1.01]"
            >
              <button
                onClick={() => toggleTask({ id: task._id })}
                className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                  task.isCompleted
                    ? "border-[var(--success)] bg-[var(--success)]"
                    : "border-[var(--border)] hover:border-[var(--primary)]"
                )}
              >
                {task.isCompleted && (
                  <CheckSquare className="w-4 h-4 text-white" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 transition-all",
                  task.isCompleted && "line-through opacity-50"
                )}
              >
                {task.text}
              </span>
              <button
                onClick={() => removeTask({ id: task._id })}
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
