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
    })

    try {
      const status = await api.uploadVideo(file)
      updateTask(tempId, {
        id: status.id,
        status: status.status as TaskStatus,
        progress: status.progress,
        indexed_frames: status.indexed_frames,
        total_frames: status.total_frames,
      })

      const realId = status.id
      const poll = setInterval(async () => {
        try {
          const latest = await api.getVideoStatus(realId)
          updateTask(realId, {
            status: latest.status as TaskStatus,
            progress: latest.progress,
            indexed_frames: latest.indexed_frames,
            total_frames: latest.total_frames,
            error: latest.error ?? undefined,
          })

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
