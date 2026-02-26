import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import Body from '@/components/body'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: function IndexPage() {
    const { q } = Route.useSearch()
    return <Body query={q ?? ''} />
  },
})
