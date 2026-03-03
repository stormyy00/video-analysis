import { create } from 'zustand'
import { api } from '@/lib/api'

export type TaskStatus = 'uploading' | 'pending' | 'indexing' | 'ready' | 'error'
export type PanelView = 'expanded' | 'minimized' | 'closed'

export interface UploadTask {
  id: string
  filename: string
  status: TaskStatus
  progress: number
  indexed_frames: number
  total_frames: number
  error?: string
  uploadStartTime: number
  uploadedBytes: number
  totalBytes: number
  indexingStartTime: number
}

interface ActivityStore {
  tasks: UploadTask[]
  panelView: PanelView
  setPanelView: (v: PanelView) => void
  togglePanel: () => void
  addTask: (task: UploadTask) => void
  updateTask: (id: string, updates: Partial<UploadTask>) => void
  removeTask: (id: string) => void
  uploadAndTrack: (file: File) => Promise<void>
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`
  const mins = Math.ceil(seconds / 60)
  return `~${mins} min remaining`
}

export function calculateEta(task: UploadTask): string | null {
  const now = Date.now()
  if (task.status === 'uploading') {
    if (task.uploadedBytes <= 0 || task.uploadStartTime <= 0) return null
    const elapsed = (now - task.uploadStartTime) / 1000
    if (elapsed < 1) return null
    const rate = task.uploadedBytes / elapsed
    const remaining = (task.totalBytes - task.uploadedBytes) / rate
    return formatEta(remaining)
  }
  if (task.status === 'indexing' && task.indexed_frames > 0 && task.indexingStartTime > 0) {
    const elapsed = (now - task.indexingStartTime) / 1000
    if (elapsed < 1) return null
    const rate = task.indexed_frames / elapsed
    const remaining = (task.total_frames - task.indexed_frames) / rate
    return formatEta(remaining)
  }
  return null
}

export function combinedProgress(task: UploadTask): number {
  if (task.status === 'uploading') {
    if (task.totalBytes === 0) return 0
    return (task.uploadedBytes / task.totalBytes) * 0.4
  }
  if (task.status === 'pending') return 0.4
  if (task.status === 'indexing') {
    return 0.4 + task.progress * 0.6
  }
  if (task.status === 'ready') return 1
  return 0
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  tasks: [],
  panelView: 'closed',

  setPanelView: (v) => set({ panelView: v }),

  togglePanel: () =>
    set((s) => ({ panelView: s.panelView === 'closed' ? 'expanded' : 'closed' })),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  uploadAndTrack: async (file: File) => {
    const { addTask, updateTask, removeTask, setPanelView } = get()
    const tempId = crypto.randomUUID()

    setPanelView('expanded')

    addTask({
      id: tempId,
      filename: file.name,
      status: 'uploading',
      progress: 0,
      indexed_frames: 0,
      total_frames: 0,
      uploadStartTime: Date.now(),
      uploadedBytes: 0,
      totalBytes: file.size,
      indexingStartTime: 0,
    })

    try {
      const status = await api.uploadVideoWithProgress(file, (loaded, total) => {
        updateTask(tempId, { uploadedBytes: loaded, totalBytes: total })
      })

      updateTask(tempId, {
        id: status.id,
        status: status.status as TaskStatus,
        progress: status.progress,
        indexed_frames: status.indexed_frames,
        total_frames: status.total_frames,
      })

      const realId = status.id
      let hasSetIndexingStart = false

      const poll = setInterval(async () => {
        try {
          const latest = await api.getVideoStatus(realId)

          const updates: Partial<UploadTask> = {
            status: latest.status as TaskStatus,
            progress: latest.progress,
            indexed_frames: latest.indexed_frames,
            total_frames: latest.total_frames,
            error: latest.error ?? undefined,
          }

          if (latest.status === 'indexing' && !hasSetIndexingStart) {
            updates.indexingStartTime = Date.now()
            hasSetIndexingStart = true
          }

          updateTask(realId, updates)

          if (latest.status === 'ready' || latest.status === 'error') {
            clearInterval(poll)
            if (latest.status === 'ready') {
              setTimeout(() => removeTask(realId), 5000)
            }
          }
        } catch {
          clearInterval(poll)
          updateTask(realId, { status: 'error', error: 'Status check failed' })
        }
      }, 2000)
    } catch {
      updateTask(tempId, { status: 'error', error: 'Upload failed' })
    }
  },
}))
