import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import ActivityPanel from '@/components/activity-panel'
import { SidebarInset, SidebarProvider } from './ui/sidebar'
import Sidebar from './sidebar'
import { useActivityStore } from '@/stores/activity'
import { useTheme } from '@/hooks/use-theme'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb'
import { Link, useLocation } from '@tanstack/react-router'
import { House, Sun, Moon, Clock, Film } from 'lucide-react'
import { api } from '@/lib/api'
import { formatTime } from '@/components/card'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { panelView, togglePanel } = useActivityStore()
  const { theme, setTheme } = useTheme()
  const pathname = useLocation().pathname
  const pathSegments = pathname.split('/').filter((s: string) => s)
  const relevantSegments = pathSegments[0] === '' ? pathSegments.slice(1) : pathSegments

  const isDark = theme === 'dark'

  // Detect video detail route: /video/:videoId
  const isVideoRoute = relevantSegments[0] === 'video' && relevantSegments.length === 2
  const videoId = isVideoRoute ? relevantSegments[1] : undefined

  const { data: video } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => api.getVideoStatus(videoId!),
    enabled: !!videoId,
  })

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider defaultOpen={false}>
        <Sidebar
          onActivityToggle={togglePanel}
          activityOpen={panelView !== 'closed'}
        />
        <SidebarInset>
          <div className="flex-1 overflow-auto p-4 md:p-6 bg-background">
            {/* Breadcrumb row with theme toggle */}
            <div className="flex items-center justify-between mb-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/" className="flex gap-1.5 items-center text-muted-foreground hover:text-foreground transition-colors">
                        <House size={13} /> Home
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {isVideoRoute ? (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="flex items-center gap-2">
                          <div className="size-5 rounded-md bg-[#CE775F] flex items-center justify-center shrink-0">
                            <Film size={9} className="text-white" />
                          </div>
                          <span className="truncate max-w-[200px]">
                            {video?.filename ?? 'Loading...'}
                          </span>
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  ) : (
                    <>
                      {relevantSegments.length > 0 && <BreadcrumbSeparator />}
                      {relevantSegments.map((segment, index) => {
                        const href = `/${relevantSegments.slice(0, index + 1).join('/')}`
                        const isLast = index === relevantSegments.length - 1
                        const label = segment.length > 20 ? `${segment.slice(0, 8)}...` : segment
                        return (
                          <BreadcrumbItem key={href}>
                            {isLast ? (
                              <BreadcrumbPage className="capitalize">{label}</BreadcrumbPage>
                            ) : (
                              <>
                                <BreadcrumbLink asChild className="capitalize">
                                  <Link to={href}>{label}</Link>
                                </BreadcrumbLink>
                                <BreadcrumbSeparator />
                              </>
                            )}
                          </BreadcrumbItem>
                        )
                      })}
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>

              {/* Right side: duration badge (video route) + theme toggle */}
              <div className="flex items-center gap-2">
                {isVideoRoute && video?.duration != null && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={12} />
                    <span className="text-xs font-mono tabular-nums">{formatTime(video.duration)}</span>
                  </div>
                )}
                <button
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Toggle theme"
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              </div>
            </div>

            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <ActivityPanel />
    </div>
  )
}
