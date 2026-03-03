import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import VideoDetailPage from '@/components/video-detail-page'

const searchSchema = z.object({
  t: z.number().optional(),
})

export const Route = createFileRoute('/video/$videoId')({
  validateSearch: (search) => searchSchema.parse(search),
  component: function VideoPage() {
    const { videoId } = Route.useParams()
    const { t } = Route.useSearch()
    return <VideoDetailPage videoId={videoId} startTime={t} />
  },
})
