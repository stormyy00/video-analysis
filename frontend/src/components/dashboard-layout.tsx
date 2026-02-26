import type { ReactNode } from 'react'
import ActivityPanel from '@/components/activity-panel'
import { SidebarInset, SidebarProvider } from './ui/sidebar'
import Sidebar from './sidebar'
import { useActivityStore } from '@/stores/activity'
import { useTheme } from '@/hooks/use-theme'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb'
import { Link, useLocation } from '@tanstack/react-router'
import { House, Sun, Moon } from 'lucide-react'

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
                  {relevantSegments.length > 0 && <BreadcrumbSeparator />}
                  {relevantSegments.map((segment, index) => {
                    const href = `/admin/${relevantSegments.slice(0, index + 1).join('/')}`
                    const isLast = index === relevantSegments.length - 1
                    return (
                      <>
                        <BreadcrumbItem key={href}>
                          {isLast ? (
                            <BreadcrumbPage className="capitalize">{segment}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild className="capitalize">
                              <Link to={href}>{segment}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!isLast && <BreadcrumbSeparator />}
                      </>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>

              {/* Theme toggle */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>

            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <ActivityPanel />
    </div>
  )
}
