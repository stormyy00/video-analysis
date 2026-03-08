import { useRef } from 'react'
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { usePlayerStore } from '@/stores/player'

export default function VideoJSPlayer() {
  const result = usePlayerStore((s) => s.result)
  const open = usePlayerStore((s) => s.open)
  const closePlayer = usePlayerStore((s) => s.closePlayer)
  const playerRef = useRef<MediaPlayerInstance>(null)

  const handleCanPlay = () => {
    const player = playerRef.current
    if (!player || !result) return
    player.currentTime = result.t_start
    void player.play()
  }

  if (!open || !result) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-white/70 text-sm font-medium truncate">{result.video_title}</span>
        <button
          onClick={closePlayer}
          className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Close player"
        >
          <X size={18} />
        </button>
      </div>

      {/* Vidstack player */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <MediaPlayer
          ref={playerRef}
          key={`${result.video_id}-${result.t_start}`}
          title={result.video_title}
          src={{ src: api.streamUrl(result.video_id), type: 'video/mp4' }}
          playsInline
          className="w-full max-w-6xl"
          onCanPlay={handleCanPlay}
        >
          <MediaProvider />
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
      </div>
    </div>
  )
}
