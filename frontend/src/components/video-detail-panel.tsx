import { useRef, useEffect } from 'react'
import { Search, Loader, X, FileText, Scissors } from 'lucide-react'
import { useVideoDetailPanel, type PanelTab } from '@/stores/video-detail-panel'
import { api, type SearchResult, type ThumbnailEntry } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatTime } from '@/components/card'

interface VideoDetailPanelProps {
  thumbnails: ThumbnailEntry[]
  searchResults: SearchResult[]
  matchedTimestamps: Set<number>
  hasSearch: boolean
  isSearching: boolean
  searchInput: string
  searchQuery: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  seekTo: (timestamp: number) => void
}

export default function VideoDetailPanel({
  thumbnails,
  searchResults,
  matchedTimestamps,
  hasSearch,
  isSearching,
  searchInput,
  searchQuery,
  onSearchChange,
  onClearSearch,
  seekTo,
}: VideoDetailPanelProps) {
  const { activeTab } = useVideoDetailPanel()
  const isOpen = activeTab !== null

  return (
    <div
      className={cn(
        'h-full border-l border-zinc-800/50 bg-[#0f0f10] flex flex-col',
        'transition-[width,opacity] duration-300 ease-in-out overflow-hidden',
        isOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0',
      )}
    >
      {isOpen && (
        <div className="w-[380px] h-full flex flex-col min-w-[380px]">
          <PanelHeader />
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'search' && (
              <SearchPanelContent
                searchInput={searchInput}
                searchQuery={searchQuery}
                isSearching={isSearching}
                searchResults={searchResults}
                onSearchChange={onSearchChange}
                onClearSearch={onClearSearch}
                seekTo={seekTo}
              />
            )}
            {activeTab === 'frames' && (
              <FramesPanelContent
                thumbnails={thumbnails}
                matchedTimestamps={matchedTimestamps}
                hasSearch={hasSearch}
                seekTo={seekTo}
                searchResults={searchResults}
              />
            )}
            {activeTab === 'transcript' && <TranscriptPanelContent />}
            {activeTab === 'editor' && <EditorPanelContent />}
          </div>
        </div>
      )}
    </div>
  )
}

function PanelHeader() {
  const { activeTab, closePanel } = useVideoDetailPanel()
  const titles: Record<PanelTab, string> = {
    search: 'Search',
    frames: 'Frames',
    transcript: 'Transcript',
    editor: 'Editor',
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 shrink-0">
      <span className="text-sm font-medium text-zinc-200">{titles[activeTab!]}</span>
      <button
        onClick={closePanel}
        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function SearchPanelContent({
  searchInput,
  searchQuery,
  isSearching,
  searchResults,
  onSearchChange,
  onClearSearch,
  seekTo,
}: {
  searchInput: string
  searchQuery: string
  isSearching: boolean
  searchResults: SearchResult[]
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  seekTo: (timestamp: number) => void
}) {
  const hasSearch = searchQuery.trim().length > 0

  return (
    <div className="p-4 space-y-4">
      <div
        className={cn(
          'flex items-center gap-2.5 px-3.5 h-10 rounded-xl',
          'bg-zinc-800/50 border transition-all duration-200',
          searchInput
            ? 'border-search-blue/40 ring-1 ring-search-blue/10'
            : 'border-zinc-700/50 hover:border-zinc-600/50',
        )}
      >
        {isSearching ? (
          <Loader size={14} className="shrink-0 text-search-blue animate-spin" />
        ) : (
          <Search
            size={14}
            className={cn(
              'shrink-0 transition-colors',
              searchInput ? 'text-search-blue' : 'text-zinc-500',
            )}
          />
        )}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClearSearch()
          }}
          placeholder="Search within this video..."
          className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] text-zinc-200 placeholder:text-zinc-500 leading-none"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        {searchInput && (
          <button
            onClick={onClearSearch}
            className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px] font-mono"
          >
            esc
          </button>
        )}
      </div>

      {hasSearch && !isSearching && searchResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {searchResults.map((r, i) => (
            <button
              key={`${r.t_start}-${i}`}
              onClick={() => seekTo(r.t_start)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left',
                'bg-search-blue/8 border border-search-blue/20',
                'text-xs font-medium text-search-blue',
                'hover:bg-search-blue/15 transition-colors cursor-pointer',
              )}
            >
              <span className="font-mono tabular-nums">{formatTime(r.t_start)}</span>
              <span className="text-search-blue/50">–</span>
              <span className="font-mono tabular-nums">{formatTime(r.t_end)}</span>
              <span className="text-[10px] text-search-blue/60 ml-auto">
                {r.score.toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      )}

      {hasSearch && !isSearching && searchResults.length === 0 && (
        <p className="text-sm text-zinc-500">
          No scenes found for "<span className="text-zinc-300">{searchQuery}</span>"
        </p>
      )}

      {!hasSearch && (
        <p className="text-xs text-zinc-500">
          Search for scenes, objects, or actions within this video.
        </p>
      )}
    </div>
  )
}

function FramesPanelContent({
  thumbnails,
  matchedTimestamps,
  hasSearch,
  seekTo,
  searchResults,
}: {
  thumbnails: ThumbnailEntry[]
  matchedTimestamps: Set<number>
  hasSearch: boolean
  seekTo: (timestamp: number) => void
  searchResults: SearchResult[]
}) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Scroll best match into view
  useEffect(() => {
    if (searchResults.length === 0 || !gridRef.current) return
    const best = searchResults[0]
    const el = gridRef.current.querySelector(`[data-ts="${best.timestamp.toFixed(3)}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [searchResults])

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-[0.06em]">
          Timeline
        </span>
        <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
          {thumbnails.length} frames
        </span>
      </div>
      <div ref={gridRef} className="grid grid-cols-2 gap-2">
        {thumbnails.map((t) => {
          const isMatched = matchedTimestamps.has(t.timestamp)
          const isDimmed = hasSearch && !isMatched

          return (
            <button
              key={t.timestamp}
              data-ts={t.timestamp.toFixed(3)}
              onClick={() => seekTo(t.timestamp)}
              className={cn(
                'group/thumb relative rounded-lg overflow-hidden',
                'transition-all duration-200 cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-search-blue/40',
                isMatched && 'ring-2 ring-search-blue shadow-md shadow-search-blue/20',
                isDimmed && 'opacity-30',
                !hasSearch && 'hover:ring-1 hover:ring-zinc-600',
              )}
            >
              <img
                src={api.thumbnailUrl(t.url)}
                alt={`Frame at ${formatTime(t.timestamp)}`}
                className="w-full aspect-video object-cover bg-zinc-900"
                loading="lazy"
              />
              <div
                className={cn(
                  'absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-colors',
                  'flex items-end justify-center pb-1',
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded',
                    'transition-all duration-150',
                    isMatched
                      ? 'bg-search-blue/90 text-white'
                      : 'bg-black/60 text-white/80 opacity-0 group-hover/thumb:opacity-100',
                  )}
                >
                  {formatTime(t.timestamp)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TranscriptPanelContent() {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center">
      <FileText size={32} className="text-zinc-600 mb-3" />
      <p className="text-sm text-zinc-400 font-medium">Transcript</p>
      <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
    </div>
  )
}

function EditorPanelContent() {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center">
      <Scissors size={32} className="text-zinc-600 mb-3" />
      <p className="text-sm text-zinc-400 font-medium">Editor</p>
      <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
    </div>
  )
}
