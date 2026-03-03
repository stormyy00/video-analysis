import { useRef, useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useIsFetching } from '@tanstack/react-query'
import { Search, Upload, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import VideoFilter, { type VideoFilterState } from '@/components/video-filter'

interface ToolbarProps {
  query: string
  filterState?: VideoFilterState
  onFilterChange?: (state: VideoFilterState) => void
}


export default function Toolbar({ query, filterState, onFilterChange }: ToolbarProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inputValue, setInputValue] = useState(query)
  const [focused, setFocused] = useState(false)
  const { uploadAndTrack } = useActivityStore()

  const isFetching = useIsFetching({ queryKey: ['search'] }) > 0

  // Sync from URL (browser back/forward)
  useEffect(() => {
    setInputValue(query)
  }, [query])

  const commit = (value: string) => {
    void navigate({
      to: '/',
      search: value.trim() ? { q: value.trim() } : {},
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commit(value), 350)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      commit(inputValue)
    }
    if (e.key === 'Escape') {
      setInputValue('')
      commit('')
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      void uploadAndTrack(file)
    }
  }

  return (
    <div className="sticky top-0 z-40 px-6 py-3.5 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center gap-2.5">

        {/* Search input — grows to fill available space */}
        <div className={cn(
          'flex-1 min-w-0 flex items-center gap-2.5 px-3.5 h-10 rounded-xl',
          'bg-card border',
          'transition-all duration-200',
          focused
            ? 'border-search-blue/50 ring-2 ring-search-blue/15'
            : 'border-input hover:border-border/60',
        )}>
          <div className="shrink-0">
            {isFetching
              ? <Loader size={14} className="text-search-blue animate-spin" />
              : <Search size={14} className={cn('transition-colors', focused ? 'text-search-blue' : 'text-muted-foreground/70')} />
            }
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search for any moment in your videos..."
            className={cn(
              'flex-1 min-w-0 bg-transparent outline-none',
              'text-[13.5px] text-foreground placeholder:text-muted-foreground/60',
              'leading-none',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); commit('') }}
              className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-[11px] font-mono tracking-wide"
            >
              esc
            </button>
          )}
        </div>

        {/* Right controls — fixed width, never stretch */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Filter button — browse mode only */}
          {filterState && onFilterChange && (
            <VideoFilter value={filterState} onChange={onFilterChange} />
          )}

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex items-center gap-2 px-3.5 h-10 rounded-xl',
              'bg-card border border-input',
              'text-[13px] text-muted-foreground font-medium tracking-[-0.01em]',
              'hover:border-border/60 hover:text-foreground',
              'transition-all duration-200',
            )}
          >
            <Upload size={13} className="shrink-0" />
            <span>Upload</span>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.avi,.mkv,.webm,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
