import { useState, useEffect } from 'react'
import { CheckCircle2, X, Minus, Clapperboard, AlertCircle, Upload, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivityStore, type UploadTask, calculateEta, combinedProgress } from '@/stores/activity'
import { Progress } from '@/components/ui/progress'

function phaseLabel(task: UploadTask): string {
  switch (task.status) {
    case 'uploading': return 'Uploading...'
    case 'pending':   return 'Queued'
    case 'indexing':
      return task.total_frames > 0
        ? `Indexing · ${task.indexed_frames}/${task.total_frames} frames`
        : 'Indexing...'
    case 'ready':  return 'Complete'
    case 'error':  return task.error ?? 'Failed'
  }
}

function PhaseIcon({ task }: { task: UploadTask }) {
  if (task.status === 'uploading')
    return <Upload size={12} className="shrink-0 text-search-blue animate-pulse" />
  if (task.status === 'pending' || task.status === 'indexing')
    return <Cpu size={12} className="shrink-0 text-search-blue animate-spin" />
  if (task.status === 'ready')
    return <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
  return <AlertCircle size={12} className="shrink-0 text-red-500" />
}

function TaskRow({ task, onRemove }: { task: UploadTask; onRemove: () => void }) {
  const ready   = task.status === 'ready'
  const errored = task.status === 'error'
  const active  = !ready && !errored
  const pct     = Math.round(combinedProgress(task) * 100)
  const eta     = calculateEta(task)

  return (
    <div className="px-4 py-3 border-t border-border">
      {/* Top row: icon + filename + percentage + remove */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <PhaseIcon task={task} />
          <span className="text-xs text-foreground truncate font-medium tracking-tight">
            {task.filename}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {pct}%
            </span>
          )}
          <button
            onClick={onRemove}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {active && (
        <div className="mt-2 ml-5">
          <Progress
            value={pct}
            className="h-1 bg-muted"
          />
        </div>
      )}

      {/* Phase label + ETA */}
      <div className="mt-1.5 ml-5 flex items-center justify-between gap-2">
        <p className={cn(
          'text-[11px] tracking-wide',
          ready   ? 'text-emerald-500 font-medium' :
          errored ? 'text-red-500 font-medium' :
                    'text-muted-foreground'
        )}>
          {phaseLabel(task)}
        </p>
        {eta && (
          <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
            {eta}
          </span>
        )}
      </div>
    </div>
  )
}

const panelBase = cn(
  'fixed bottom-5 right-5 z-50 w-[22rem]',
  'bg-card/95 backdrop-blur-md',
  'border border-border rounded-xl',
  'shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
  'overflow-hidden',
  'animate-in slide-in-from-bottom-2 fade-in duration-200',
)

export default function ActivityPanel() {
  const { tasks, panelView, setPanelView, removeTask } = useActivityStore()

  // Tick every second while tasks are active, so ETA recalculates
  const hasActive = tasks.some(
    (t) => t.status === 'uploading' || t.status === 'indexing'
  )
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!hasActive) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasActive])

  if (panelView === 'closed') return null

  const activeCount = tasks.filter(
    (t) => t.status !== 'ready' && t.status !== 'error'
  ).length

  const label = activeCount > 0
    ? `${activeCount} processing`
    : tasks.length > 0
      ? `${tasks.length} ${tasks.length === 1 ? 'upload' : 'uploads'} complete`
      : 'Activity'

  // Minimized: compact pill
  if (panelView === 'minimized') {
    return (
      <div className={panelBase}>
        <button
          onClick={() => setPanelView('expanded')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Clapperboard size={13} className="text-search-blue" />
            <span className="text-xs font-medium text-foreground tracking-tight">{label}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setPanelView('closed') }}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label="Close"
          >
            <X size={11} />
          </button>
        </button>
      </div>
    )
  }

  // Expanded: full panel
  return (
    <div className={panelBase}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Clapperboard size={13} className="text-search-blue" />
          <span className="text-xs font-medium text-foreground tracking-tight">{label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setPanelView('minimized')}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label="Minimize"
          >
            <Minus size={11} />
          </button>
          <button
            onClick={() => setPanelView('closed')}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label="Close"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Task list */}
      {tasks.length > 0 ? (
        <div className="max-h-64 overflow-y-auto">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onRemove={() => removeTask(task.id)}
            />
          ))}
        </div>
      ) : (
        <div className="border-t border-border px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">No uploads yet</p>
        </div>
      )}
    </div>
  )
}
