import { useRef, useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useIsFetching } from '@tanstack/react-query'
import { Search, Upload, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'

interface ToolbarProps {
  query: string
}


export default function Toolbar({ query }: ToolbarProps) {
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
    <div className="sticky top-0 z-40 px-6 py-4 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-4xl mx-auto flex items-center gap-3">

        {/* Search input */}
        <div className={cn(
          'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-card border',
          'transition-all duration-200',
          focused
            ? 'border-search-blue/50 ring-2 ring-search-blue/15'
            : 'border-input hover:border-border/60',
        )}>
          <div className="shrink-0">
            {isFetching
              ? <Loader size={15} className="text-search-blue animate-spin" />
              : <Search size={15} className={cn('transition-colors', focused ? 'text-search-blue' : 'text-muted-foreground')} />
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
              'flex-1 bg-transparent outline-none',
              'text-[15px] text-foreground placeholder:text-muted-foreground',
              'leading-none',
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); commit('') }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono"
            >
              esc
            </button>
          )}
        </div>

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl',
            'bg-card border border-input',
            'text-muted-foreground text-sm font-medium',
            'hover:border-border/60 hover:text-foreground',
            'transition-all duration-200',
          )}
        >
          <Upload size={14} />
          <span>Upload</span>
        </button>

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
