import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api, type SearchResult } from '@/lib/api'
import Toolbar from '@/components/toolbar'
import VideoGroupCard, { type VideoGroup } from '@/components/video-group-card'
import VideoPlayer from '@/components/video-player'
import { cn } from '@/lib/utils'

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] gap-5 px-6 select-none">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-search-blue/10 blur-2xl scale-150" />
        <div className="relative p-5 rounded-2xl bg-card border border-border">
          <Search size={28} className="text-muted-foreground" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-foreground text-[15px] font-medium tracking-tight">
          Search your videos
        </p>
        <p className="text-muted-foreground text-sm">
          Describe any scene or moment — CLIP finds it.
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
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  })

  // Group results by video — one card per video
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

  const handleTimestampClick = (result: SearchResult) => {
    setSelectedResult(result)
    setPlayerOpen(true)
  }

  const showEmpty    = !query.trim()
  const showSkeleton = !!query && isFetching && results.length === 0
  const showNoResults = !!query && !isFetching && results.length === 0
  const showGrid     = groups.length > 0

  return (
    <>
      <Toolbar query={query} />

      <main className="px-6 py-6">
        <div className="max-w-7xl mx-auto">

          {showEmpty     && <EmptyState />}
          {showNoResults && <NoResults query={query} />}

          {(showSkeleton || showGrid) && (
            <div className={cn('grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]')}>
              {showSkeleton
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                : groups.map((g) => (
                    <div key={g.video_id} className="w-full max-w-[320px]">
                      <VideoGroupCard
                        group={g}
                        onTimestampClick={handleTimestampClick}
                      />
                    </div>
                  ))
              }
            </div>
          )}

        </div>
      </main>

      <VideoPlayer
        result={selectedResult}
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
      />
    </>
  )
}
