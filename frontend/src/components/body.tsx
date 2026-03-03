import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Search, Upload, Film } from 'lucide-react'
import { api } from '@/lib/api'
import Toolbar from '@/components/toolbar'
import VideoGroupCard, { type VideoGroup, type BrowseVideo } from '@/components/video-group-card'
import { useActivityStore } from '@/stores/activity'
import type { VideoFilterState } from '@/components/video-filter'
import { VIDEO_FILE_TYPES } from '@/components/video-filter'

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="px-3 py-2.5 space-y-2">
        <div className="h-2.5 bg-muted rounded w-2/3" />
        <div className="h-px bg-muted rounded w-full" />
      </div>
    </div>
  )
}

function EmptyState({ hasVideos }: { hasVideos: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] gap-5 px-6 select-none">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-search-blue/10 blur-2xl scale-150" />
        <div className="relative p-5 rounded-2xl bg-card border border-border">
          {hasVideos
            ? <Search size={28} className="text-muted-foreground" />
            : <Film size={28} className="text-muted-foreground" />
          }
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-foreground text-[15px] font-medium tracking-tight">
          {hasVideos ? 'Search your videos' : 'Upload your first video'}
        </p>
        <p className="text-muted-foreground text-sm">
          {hasVideos
            ? 'Describe any scene or moment — CLIP finds it.'
            : 'Drop a video file or click upload to get started.'
          }
        </p>
      </div>
    </div>
  )
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 px-6 select-none">
      <p className="text-muted-foreground text-sm">
        No scenes found for{' '}
        <span className="text-foreground font-medium">"{query}"</span>
      </p>
      <p className="text-muted-foreground/50 text-xs">Try a different description or lower the threshold</p>
    </div>
  )
}

interface BodyProps {
  query: string
}

export default function Body({ query }: BodyProps) {
  const uploadAndTrack = useActivityStore((s) => s.uploadAndTrack)

  const [filterState, setFilterState] = useState<VideoFilterState>({
    sortOrder: 'recent',
    selectedFileTypes: [],
  })

  const onDrop = useCallback((accepted: File[]) => {
    for (const file of accepted) {
      void uploadAndTrack(file)
    }
  }, [uploadAndTrack])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] },
    noClick: true,
    noKeyboard: true,
  })

  // Search results
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  })

  // All videos for browse mode
  const { data: allVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.listVideos(),
    staleTime: 10_000,
    refetchInterval: 5_000,
  })

  // Group search results by video
  const groups = useMemo<VideoGroup[]>(() => {
    const map = new Map<string, VideoGroup>()
    for (const r of results) {
      if (!map.has(r.video_id)) {
        map.set(r.video_id, {
          video_id: r.video_id,
          video_title: r.video_title,
          duration: r.duration,
          results: [],
          bestResult: r,
        })
      }
      const g = map.get(r.video_id)!
      g.results.push(r)
      if (r.score > g.bestResult.score) g.bestResult = r
    }
    for (const g of map.values()) {
      g.results.sort((a, b) => a.timestamp - b.timestamp)
    }
    return Array.from(map.values())
  }, [results])

  // Filter and sort videos for browse mode
  const browseVideos = useMemo<BrowseVideo[]>(() => {
    let filtered = allVideos.filter((v) => {
      if (v.status !== 'ready') return false
      // Apply file type filter if any are selected
      if (filterState.selectedFileTypes.length > 0) {
        const ext = v.filename.split('.').pop()?.toLowerCase()
        const matchingType = VIDEO_FILE_TYPES.find((ft) =>
          ft.extensions.some((e) => e.replace('.', '') === ext)
        )
        if (!matchingType || !filterState.selectedFileTypes.includes(matchingType.id)) {
          return false
        }
      }
      return true
    })
    filtered.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return filterState.sortOrder === 'recent' ? tb - ta : ta - tb
    })
    return filtered.map((v) => ({
      video_id: v.id,
      video_title: v.filename,
      duration: v.duration,
      created_at: v.created_at,
    }))
  }, [allVideos, filterState])

  const hasQuery = query.trim().length > 0
  const hasReadyVideos = allVideos.some((v) => v.status === 'ready')

  type View =
    | { kind: 'browse-empty' }
    | { kind: 'browse-loading' }
    | { kind: 'browse-grid'; videos: BrowseVideo[] }
    | { kind: 'search-loading' }
    | { kind: 'search-empty'; query: string }
    | { kind: 'search-grid'; groups: VideoGroup[] }

  const view: View = hasQuery
    ? isFetching && results.length === 0
      ? { kind: 'search-loading' }
      : groups.length > 0
        ? { kind: 'search-grid', groups }
        : { kind: 'search-empty', query }
    : videosLoading && browseVideos.length === 0
      ? { kind: 'browse-loading' }
      : browseVideos.length > 0
        ? { kind: 'browse-grid', videos: browseVideos }
        : { kind: 'browse-empty' }

  return (
    <div {...getRootProps()} className="relative min-h-full">
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-10 rounded-2xl border-2 border-dashed border-search-blue/50 bg-card">
            <Upload size={32} className="text-search-blue" />
            <p className="text-sm font-medium text-foreground">Drop videos to upload</p>
          </div>
        </div>
      )}

      <Toolbar
        query={query}
        filterState={!hasQuery ? filterState : undefined}
        onFilterChange={!hasQuery ? setFilterState : undefined}
      />

      <main className="px-6 py-6">
        <div className="max-w-7xl mx-auto">

          {view.kind === 'browse-empty' && <EmptyState hasVideos={hasReadyVideos} />}
          {view.kind === 'search-empty' && <NoResults query={view.query} />}

          {(view.kind === 'browse-loading' || view.kind === 'search-loading') && (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {view.kind === 'browse-grid' && (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {view.videos.map((v) => (
                <div key={v.video_id} className="w-full max-w-[320px]">
                  <VideoGroupCard data={v} />
                </div>
              ))}
            </div>
          )}

          {view.kind === 'search-grid' && (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {view.groups.map((g) => (
                <div key={g.video_id} className="w-full max-w-[320px]">
                  <VideoGroupCard data={g} />
                </div>
              ))}
            </div>
          )}

        </div>
      </main>

    </div>
  )
}
