import { useRef, useState, type WheelEventHandler, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { SearchResult } from '@/lib/api'
import { formatTime } from '@/components/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Play, Video } from 'lucide-react'

export interface VideoGroup {
  video_id: string
  video_title: string
  duration: number | null
  results: SearchResult[]   // sorted by timestamp ascending
  bestResult: SearchResult  // highest score — used for thumbnail + hover preview
}

interface VideoGroupCardProps {
  group: VideoGroup
  onTimestampClick: (result: SearchResult) => void
}

export default function VideoGroupCard({ group, onTimestampClick }: VideoGroupCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [resolvedDuration, setResolvedDuration] = useState<number | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const hasSeededStartRef = useRef(false)
  const isScrubbingRef = useRef(false)

  const { bestResult, results, video_title } = group

  const effectiveDuration =
    group.duration != null && group.duration > 0
      ? group.duration
      : Math.max(...results.map((r) => r.timestamp)) + 30

  const duration = resolvedDuration ?? effectiveDuration
  const progressPct = Math.min(Math.max((currentTime / duration) * 100, 0), 100)

  const seekTo = (nextTime: number) => {
    const v = videoRef.current
    const clamped = Math.min(Math.max(nextTime, 0), duration)
    setCurrentTime(clamped)
    if (!v) return

    // Queue seeks until metadata is available; prevents wheel scrubbing from being ignored.
    if (v.readyState >= 1) {
      v.currentTime = clamped
      return
    }
    pendingSeekRef.current = clamped
  }

  const getPctFromPointer = (clientX: number) => {
    const bar = progressBarRef.current
    if (!bar) return null
    const rect = bar.getBoundingClientRect()
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }

  const handleProgressPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const pct = getPctFromPointer(e.clientX)
    if (pct == null) return
    isScrubbingRef.current = true
    setIsScrubbing(true)
    videoRef.current?.pause()
    seekTo(pct * duration)
  }

  const handleProgressPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pct = getPctFromPointer(e.clientX)
    if (pct == null) return
    setHoverPct(pct * 100)
    if (isScrubbingRef.current) {
      seekTo(pct * duration)
    }
  }

  const handleProgressPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!isScrubbingRef.current) return
    isScrubbingRef.current = false
    setIsScrubbing(false)
    if (isHovered) void videoRef.current?.play()
  }

  const handleLoadedMetadata = () => {
    const v = videoRef.current
    if (!v) return

    if (Number.isFinite(v.duration) && v.duration > 0) {
      setResolvedDuration(v.duration)
    }

    if (pendingSeekRef.current != null) {
      v.currentTime = pendingSeekRef.current
      pendingSeekRef.current = null
    }
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    const v = videoRef.current
    if (!v) return

    if (!hasSeededStartRef.current) {
      seekTo(bestResult.t_start)
      hasSeededStartRef.current = true
    }

    void v.play()
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    videoRef.current?.pause()
  }

  const handleWheel: WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    const v = videoRef.current
    if (!v) return

    setIsHovered(true)
    v.pause()

    const direction = Math.sign(e.deltaY)
    const magnitude = Math.min(Math.abs(e.deltaY) * 0.03, 4)
    const deltaSeconds = direction * magnitude
    seekTo(currentTime + deltaSeconds)
  }

  return (
    <div
      className={cn(
        'group relative w-full rounded-[24px] border p-2.5',
        'bg-zinc-200/90 border-zinc-300/80 shadow-[0_10px_26px_rgba(16,24,40,0.10)]',
        'dark:bg-zinc-900/85 dark:border-zinc-800/90 dark:shadow-[0_14px_32px_rgba(0,0,0,0.55)]',
        'transition-all duration-200 ease-out hover:-translate-y-0.5',
      )}
    >
      <div className="absolute left-4 top-4 size-10 rounded-xl border border-zinc-300/80 bg-zinc-100/60 dark:border-zinc-700/70 dark:bg-zinc-800/70" />

      {/* Preview */}
      <div
        className="relative z-10 aspect-video overflow-hidden rounded-[20px] bg-black cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onClick={() => onTimestampClick(bestResult)}
      >
        <img
          src={api.thumbnailUrl(bestResult.thumbnail_url)}
          alt={video_title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: isHovered ? 0 : 1 }}
          loading="lazy"
        />

        <video
          ref={videoRef}
          src={api.streamUrl(group.video_id)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            isHovered ? 'opacity-100' : 'opacity-0',
          )}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setCurrentTime(t)
            // Loop the first matched scene while hovering (skip when manually scrubbing)
            if (isHovered && !isScrubbingRef.current && t >= bestResult.t_end) {
              e.currentTarget.currentTime = bestResult.t_start
            }
          }}
          onDurationChange={(e) => {
            const next = e.currentTarget.duration
            if (Number.isFinite(next) && next > 0) setResolvedDuration(next)
          }}
        />

        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-14 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-2xl">
            <Play size={22} className="text-white fill-white translate-x-0.5" />
          </div>
        </div>

        <div className="absolute left-3 right-3 bottom-3 flex items-center gap-2">
          {/* Interactive scrub bar */}
          <div
            ref={progressBarRef}
            className="relative h-1 flex-1 rounded-full bg-white/25 cursor-pointer hover:h-1.5 transition-[height] duration-100"
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerLeave={() => setHoverPct(null)}
          >
            {/* Fill */}
            <div
              className={cn(
                'h-full rounded-full bg-search-blue pointer-events-none',
                !isScrubbing && 'transition-[width] duration-100',
              )}
              style={{ width: `${progressPct}%` }}
            />
            {/* Hover position line */}
            {hoverPct != null && !isScrubbing && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-px h-3 rounded-full bg-white/60 pointer-events-none"
                style={{ left: `${hoverPct}%` }}
              />
            )}
            {/* Scrub thumb */}
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md pointer-events-none transition-opacity duration-100',
                isScrubbing ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100',
              )}
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 tabular-nums">
            {isScrubbing && hoverPct != null
              ? formatTime((hoverPct / 100) * duration)
              : formatTime(duration)}
          </span>
        </div>

        {/* Match count badge */}
        {results.length > 1 && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <span className="text-[10px] font-mono text-white/85 tracking-wide">
              {results.length} matches
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2.5 px-1 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <div className="size-6 rounded-lg bg-[#CE775F] flex items-center justify-center shadow-sm">
            <Video size={11} className="text-white" />
          </div>
          <p className="truncate text-[15px]/none tracking-tight font-semibold text-zinc-800 dark:text-zinc-100">
            {video_title}
          </p>
        </div>
        <span className="shrink-0 text-[14px]/none tracking-tight text-zinc-500 dark:text-zinc-400">
          1d
        </span>
      </div>

      {/* Timestamp markers */}
      <div className="relative mx-1 mt-2.5 h-7 rounded-full bg-white/40 dark:bg-zinc-950/40 border border-zinc-300/70 dark:border-zinc-800/70">
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-zinc-400/40 dark:bg-zinc-500/40" />
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-px bg-search-blue/70 transition-[width] duration-100"
          style={{ width: `calc(${progressPct}% * (100% - 24px) / 100)` }}
        />
        {results.map((r) => {
          const startPct = Math.min(Math.max((r.t_start / effectiveDuration) * 100, 0), 100)
          const widthPct = Math.max(((r.t_end - r.t_start) / effectiveDuration) * 100, 1.5)
          return (
            <Tooltip key={r.t_start}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTimestampClick(r)}
                  style={{
                    left: `calc(${startPct}% * (100% - 24px) / 100 + 12px)`,
                    width: `calc(${widthPct}% * (100% - 24px) / 100)`,
                  }}
                  className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-search-blue"
                  aria-label={`Jump to ${formatTime(r.t_start)}`}
                >
                  <div
                    className={cn(
                      'h-full w-full rounded-full bg-search-blue transition-all duration-150 hover:brightness-125',
                      r.score >= 30
                        ? 'opacity-100'
                        : r.score >= 25
                          ? 'opacity-75'
                          : 'opacity-50',
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] font-mono px-1.5 py-0.5">
                {formatTime(r.t_start)} → {formatTime(r.t_end)}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
