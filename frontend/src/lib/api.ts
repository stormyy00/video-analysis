const BASE = 'http://localhost:8000'

export interface SearchResult {
  video_id: string
  timestamp: number     // best-matching frame within the scene
  t_start: number       // scene window start
  t_end: number         // scene window end
  score: number
  thumbnail_url: string
  video_title: string
  duration: number | null
}

export interface VideoStatus {
  id: string
  filename: string
  status: 'pending' | 'indexing' | 'ready' | 'error'
  duration: number | null
  progress: number
  indexed_frames: number
  total_frames: number
  error: string | null
}

export const api = {
  async search(query: string, n = 8, threshold = 24): Promise<SearchResult[]> {
    const res = await fetch(`${BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, n, threshold }),
    })
    if (!res.ok) throw new Error('Search failed')
    return res.json() as Promise<SearchResult[]>
  },

  async uploadVideo(file: File): Promise<VideoStatus> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/api/videos/upload`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json() as Promise<VideoStatus>
  },

  async getVideoStatus(id: string): Promise<VideoStatus> {
    const res = await fetch(`${BASE}/api/videos/${id}/status`)
    if (!res.ok) throw new Error('Failed to get status')
    return res.json() as Promise<VideoStatus>
  },

  async listVideos(): Promise<VideoStatus[]> {
    const res = await fetch(`${BASE}/api/videos`)
    if (!res.ok) throw new Error('Failed to list videos')
    return res.json() as Promise<VideoStatus[]>
  },

  streamUrl(videoId: string): string {
    return `${BASE}/api/videos/${videoId}/stream`
  },

  thumbnailUrl(path: string): string {
    return `${BASE}${path}`
  },
}
