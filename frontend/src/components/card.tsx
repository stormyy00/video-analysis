import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { api, type SearchResult } from '@/lib/api'
import { Play } from 'lucide-react'

export function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className={cn(
      'font-mono text-[10px] px-1.5 py-0.5 rounded tracking-wider tabular-nums',
      score >= 30
        ? 'bg-search-blue/90 text-white'
        : score >= 25
          ? 'bg-black/40 text-white/70'
          : 'bg-black/25 text-white/50'
    )}>
      {score.toFixed(1)}
    </span>
  )
}

interface CardProps {
  result: SearchResult
  onClick: (result: SearchResult) => void
}

export default function Card({ result, onClick }: CardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const t0 = formatTime(result.timestamp)
  const t1 = formatTime(result.timestamp + 1)

  const handleMouseEnter = () => {
    setIsHovered(true)
    const v = videoRef.current
    if (!v) return
    v.currentTime = result.timestamp
    void v.play()
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    const v = videoRef.current
    if (!v) return
    v.pause()
  }

  return (
    <button
      onClick={() => onClick(result)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative text-left w-full rounded-xl overflow-hidden',
        'bg-card border border-border',
        'transition-all duration-200 ease-out',
        'hover:border-border/60 dark:hover:border-white/15',
        'hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]',
        'hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-search-blue',
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {/* Static thumbnail — base layer */}
        <img
          src={api.thumbnailUrl(result.thumbnail_url)}
          alt={`${result.video_title} at ${t0}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: isHovered ? 0 : 1 }}
          loading="lazy"
        />

        {/* Hover video preview */}
        <video
          ref={videoRef}
          src={api.streamUrl(result.video_id)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          muted
          playsInline
          preload="none"
        />

        {/* Play overlay on hover (only when video isn't playing yet) */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-200',
          isHovered ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        )}>
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-3 shadow-lg">
            <Play size={16} className="text-white fill-white translate-x-px" />
          </div>
        </div>

        {/* Bottom timecode bar */}
        <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-8 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between">
          <span className="font-mono text-[10px] text-white/70 tracking-widest uppercase">
            {t0} — {t1}
          </span>
          <ScorePill score={result.score} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center gap-1.5">
        <p className="text-[11px] text-muted-foreground truncate leading-none tracking-tight">
          {result.video_title}
        </p>
      </div>
    </button>
  )
}
