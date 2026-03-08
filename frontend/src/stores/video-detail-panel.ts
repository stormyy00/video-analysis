import { create } from 'zustand'

export type PanelTab = 'search' | 'frames' | 'transcript' | 'editor'

interface VideoDetailPanelStore {
  activeTab: PanelTab | null
  toggleTab: (tab: PanelTab) => void
  closePanel: () => void
}

export const useVideoDetailPanel = create<VideoDetailPanelStore>((set, get) => ({
  activeTab: null,
  toggleTab: (tab) => set({ activeTab: get().activeTab === tab ? null : tab }),
  closePanel: () => set({ activeTab: null }),
}))
