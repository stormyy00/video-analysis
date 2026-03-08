import { useState } from 'react'
import { SlidersHorizontal, Check, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type SortOrder = 'recent' | 'oldest'

export interface VideoFileTypeOption {
  id: string
  label: string
  extensions: string[]
}

export const VIDEO_FILE_TYPES: VideoFileTypeOption[] = [
  { id: 'mp4', label: 'MP4', extensions: ['.mp4'] },
  { id: 'mov', label: 'MOV', extensions: ['.mov'] },
  { id: 'avi', label: 'AVI', extensions: ['.avi'] },
  { id: 'mkv', label: 'MKV', extensions: ['.mkv'] },
  { id: 'webm', label: 'WebM', extensions: ['.webm'] },
]

export interface VideoFilterState {
  sortOrder: SortOrder
  selectedFileTypes: string[]
}

export interface VideoFilterProps {
  value: VideoFilterState
  onChange: (state: VideoFilterState) => void
  className?: string
}

export default function VideoFilter({ value, onChange, className }: VideoFilterProps) {
  const [open, setOpen] = useState(false)

  const hasActiveFilters = value.selectedFileTypes.length > 0 &&
    value.selectedFileTypes.length < VIDEO_FILE_TYPES.length

  const handleSortChange = (sortOrder: SortOrder) => {
    onChange({ ...value, sortOrder })
  }

  const handleToggleFileType = (fileTypeId: string) => {
    const newSelected = value.selectedFileTypes.includes(fileTypeId)
      ? value.selectedFileTypes.filter((id) => id !== fileTypeId)
      : [...value.selectedFileTypes, fileTypeId]
    onChange({ ...value, selectedFileTypes: newSelected })
  }

  const handleClearFileTypes = () => {
    onChange({ ...value, selectedFileTypes: [] })
  }

  const sortLabel = value.sortOrder === 'oldest' ? 'Date created ↑' : 'Date created'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3.5 h-10 rounded-xl',
            'bg-card border border-input',
            'text-[13px] font-medium tracking-[-0.01em]',
            'transition-all duration-200 ease-out',
            hasActiveFilters
              ? 'border-search-blue/30 text-search-blue bg-search-blue/5'
              : 'text-muted-foreground hover:text-foreground hover:border-border/60',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-search-blue/20 focus-visible:ring-offset-1',
            className,
          )}
        >
          <CalendarDays
            className={cn(
              'w-3.5 h-3.5 shrink-0 transition-colors duration-200',
              hasActiveFilters ? 'text-search-blue' : 'text-muted-foreground',
            )}
          />
          <span className="whitespace-nowrap">{sortLabel}</span>
          {hasActiveFilters && (
            <span
              className={cn(
                'flex items-center justify-center',
                'min-w-[17px] h-[17px] px-1 rounded-full',
                'text-[10px] font-semibold tabular-nums',
                'bg-search-blue text-white',
                'animate-in fade-in-0 zoom-in-95 duration-150',
              )}
            >
              {value.selectedFileTypes.length}
            </span>
          )}
          <SlidersHorizontal
            className={cn(
              'w-3 h-3 shrink-0 ml-0.5 transition-colors duration-200',
              hasActiveFilters ? 'text-search-blue/70' : 'text-muted-foreground/50',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'w-56 p-0',
          'bg-card border border-border',
          'rounded-xl shadow-lg shadow-black/10',
          'overflow-hidden',
        )}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-foreground/70 uppercase tracking-[0.05em]">
            Sort & Filter
          </h3>
          {hasActiveFilters && (
            <button
              onClick={handleClearFileTypes}
              className={cn(
                'text-[11px] font-medium text-muted-foreground',
                'hover:text-foreground transition-colors duration-150',
                'px-1.5 py-0.5 rounded-md hover:bg-muted',
              )}
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort Order */}
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10.5px] font-semibold text-muted-foreground/60 uppercase tracking-[0.06em] mb-2">
            Date created
          </p>
          <div className="flex p-0.5 rounded-lg bg-muted border border-border gap-0.5">
            <SortTab
              active={value.sortOrder === 'recent'}
              onClick={() => handleSortChange('recent')}
            >
              Newest first
            </SortTab>
            <SortTab
              active={value.sortOrder === 'oldest'}
              onClick={() => handleSortChange('oldest')}
            >
              Oldest first
            </SortTab>
          </div>
        </div>

        {/* File Type Badges */}
        <div className="px-4 py-3">
          <p className="text-[10.5px] font-semibold text-muted-foreground/60 uppercase tracking-[0.06em] mb-2.5">
            File type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VIDEO_FILE_TYPES.map((option) => (
              <FileTypeBadge
                key={option.id}
                label={option.label}
                selected={value.selectedFileTypes.includes(option.id)}
                onClick={() => handleToggleFileType(option.id)}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SortTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-2.5 py-1.5 rounded-md text-center',
        'text-[11.5px] font-medium tracking-[-0.01em]',
        'transition-all duration-200 ease-out',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
      )}
    >
      {children}
    </button>
  )
}

function FileTypeBadge({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2.5 py-1.5 rounded-lg',
        'text-[12px] font-medium tracking-[-0.01em]',
        'border transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-search-blue/20',
        selected
          ? [
              'bg-search-blue border-search-blue text-white',
              'shadow-sm',
            ]
          : [
              'bg-card border-border text-muted-foreground',
              'hover:border-foreground/20 hover:text-foreground',
              'hover:bg-muted/50',
            ],
      )}
    >
      {selected && (
        <Check className="w-3 h-3 animate-in fade-in-0 zoom-in-95 duration-150" />
      )}
      <span>{label}</span>
    </button>
  )
}
