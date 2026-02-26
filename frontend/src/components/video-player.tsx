import { useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, type SearchResult } from '@/lib/api'
import { formatTime } from '@/components/card'
import { Clock } from 'lucide-react'

interface VideoPlayerProps {
  result: SearchResult | null
  open: boolean
  onClose: () => void
}

export default function VideoPlayer({ result, open, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open || !result || !videoRef.current) return

    const video = videoRef.current

    const seekAndPlay = () => {
      video.currentTime = result.t_start
      void video.play()
    }

    if (video.readyState >= 2) {
      seekAndPlay()
    } else {
      video.addEventListener('loadeddata', seekAndPlay, { once: true })
    }
  }, [open, result])

  if (!result) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-full bg-[#0c0c0d] border-[#1f1f23] p-0 overflow-hidden rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.8)] gap-0">
        {/* Header bar */}
        <DialogHeader className="px-5 py-3.5 border-b border-white/[0.06] flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3 min-w-0">
            <DialogTitle className="text-sm font-medium text-zinc-200 truncate">
              {result.video_title}
            </DialogTitle>
            <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
              <Clock size={10} />
              {formatTime(result.t_start)}
            </span>
          </div>
        </DialogHeader>

        {/* Video */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            key={result.video_id}
            src={api.streamUrl(result.video_id)}
            className="w-full h-full"
            controls
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
