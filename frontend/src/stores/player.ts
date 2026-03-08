import { create } from 'zustand'
import type { SearchResult } from '@/lib/api'

interface PlayerStore {
  result: SearchResult | null
  open: boolean
  openPlayer: (result: SearchResult) => void
  closePlayer: () => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  result: null,
  open: false,
  openPlayer: (result) => set({ result, open: true }),
  closePlayer: () => set({ open: false }),
}))
