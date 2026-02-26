import { CheckCircle2, X, Minus, Clapperboard, AlertCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivityStore, type UploadTask } from '@/stores/activity'

function formatStatus(task: UploadTask): string {
  switch (task.status) {
    case 'uploading': return 'Uploading...'
    case 'pending':   return 'Queued'
    case 'indexing':
      return task.total_frames > 0
        ? `Indexing ${task.indexed_frames} / ${task.total_frames} frames`
        : 'Indexing...'
    case 'ready':  return 'Ready'
    case 'error':  return task.error ?? 'Failed'
  }
}

function TaskRow({ task, onRemove }: { task: UploadTask; onRemove: () => void }) {
  const active  = task.status === 'uploading' || task.status === 'pending' || task.status === 'indexing'
  const ready   = task.status === 'ready'
  const errored = task.status === 'error'

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {active   && <Loader size={12} className="shrink-0 text-search-blue animate-spin" />}
          {ready    && <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />}
          {errored  && <AlertCircle size={12} className="shrink-0 text-red-500" />}
          <span className="text-xs text-foreground truncate font-medium tracking-tight">
            {task.filename}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
        >
          <X size={11} />
        </button>
      </div>

      <div className="mt-2 ml-5 space-y-1.5">
        <p className={cn(
          'text-[11px] font-mono tracking-wide',
          ready   ? 'text-emerald-500' :
          errored ? 'text-red-500' :
                    'text-muted-foreground'
        )}>
          {formatStatus(task)}
        </p>

        {task.status === 'indexing' && task.total_frames > 0 && (
          <div className="h-px w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-search-blue rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.round(task.progress * 100)}%` }}
            />
          </div>
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
