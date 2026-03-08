import { useRef, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { Search, LayoutGrid, FileText, Scissors, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useVideoDetailPanel, type PanelTab } from '@/stores/video-detail-panel'
import VideoDetailPanel from '@/components/video-detail-panel'

interface VideoDetailPageProps {
  videoId: string
  startTime?: number
}

/** Button injected into the Vidstack control bar */
function PlayerToolbarButton({
  icon: Icon,
  label,
  tab,
}: {
  icon: typeof Search
  label: string
  tab: PanelTab
}) {
  const { activeTab, toggleTab } = useVideoDetailPanel()
  const isActive = activeTab === tab

  return (
    <button
      onClick={() => toggleTab(tab)}
      aria-label={label}
      title={label}
      className={cn(
        'vds-button inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors',
        isActive
          ? 'text-search-blue'
          : 'text-white/70 hover:text-white',
      )}
    >
      <Icon size={18} />
    </button>
  )
}

/** Download button injected into the Vidstack control bar */
function PlayerDownloadButton({ videoId }: { videoId: string }) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = api.streamUrl(videoId)
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <button
      onClick={handleDownload}
      aria-label="Download"
      title="Download"
      className="vds-button inline-flex items-center justify-center w-10 h-10 rounded-md text-white/70 hover:text-white transition-colors"
    >
      <Download size={18} />
    </button>
  )
}

export default function VideoDetailPage({ videoId, startTime }: VideoDetailPageProps) {
  const playerRef = useRef<MediaPlayerInstance>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSeeded = useRef(false)

  // Fetch video metadata
  const { data: video } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => api.getVideoStatus(videoId),
  })

  // Fetch all thumbnails for timeline
  const { data: thumbnails = [] } = useQuery({
    queryKey: ['thumbnails', videoId],
    queryFn: () => api.getVideoThumbnails(videoId),
  })

  // Scoped search within this video
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['video-search', videoId, searchQuery],
    queryFn: () => api.searchVideo(videoId, searchQuery),
    enabled: searchQuery.trim().length > 0,
    staleTime: 30_000,
  })

  // Set of matched timestamps for highlighting
  const matchedTimestamps = useMemo(() => {
    if (searchResults.length === 0) return new Set<number>()
    const set = new Set<number>()
    for (const r of searchResults) {
      for (const t of thumbnails) {
        if (t.timestamp >= r.t_start && t.timestamp <= r.t_end) {
          set.add(t.timestamp)
        }
      }
    }
    return set
  }, [searchResults, thumbnails])

  const hasSearch = searchQuery.trim().length > 0

  const handleCanPlay = () => {
    if (hasSeeded.current) return
    hasSeeded.current = true
    const player = playerRef.current
    if (!player || startTime == null) return
    player.currentTime = startTime
    void player.play()
  }

  const seekTo = (timestamp: number) => {
    const player = playerRef.current
    if (!player) return
    player.currentTime = timestamp
    void player.play()
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(value), 400)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
  }

  const filename = video?.filename ?? 'Loading...'

  return (
    <div className="h-[calc(100vh-60px)] flex overflow-hidden">
      {/* Player column */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0b]">
        <div className="flex-1 flex items-center justify-center p-4">
          <MediaPlayer
            ref={playerRef}
            key={`${videoId}-${startTime ?? 0}`}
            title={filename}
            src={{ src: api.streamUrl(videoId), type: 'video/mp4' }}
            playsInline
            className="w-full max-h-full rounded-xl overflow-hidden shadow-2xl shadow-black/50"
            onCanPlay={handleCanPlay}
          >
            <MediaProvider />
            <DefaultVideoLayout
              icons={defaultLayoutIcons}
              slots={{
                beforeFullscreenButton: (
                  <>
                    <PlayerToolbarButton icon={Search} label="Search" tab="search" />
                    <PlayerToolbarButton icon={LayoutGrid} label="Frames" tab="frames" />
                    <PlayerToolbarButton icon={FileText} label="Transcript" tab="transcript" />
                    <PlayerToolbarButton icon={Scissors} label="Editor" tab="editor" />
                    <PlayerDownloadButton videoId={videoId} />
                  </>
                ),
              }}
            />
          </MediaPlayer>
        </div>
      </div>

      {/* Side panel */}
      <VideoDetailPanel
        thumbnails={thumbnails}
        searchResults={searchResults}
        matchedTimestamps={matchedTimestamps}
        hasSearch={hasSearch}
        isSearching={isSearching}
        searchInput={searchInput}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        seekTo={seekTo}
      />
    </div>
  )
}
