import { NavLink, useLocation } from 'react-router-dom'
import { BookOpenCheck, FolderSearch, ListChecks, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ConnectionStatusBadge } from '@/components/workspaces/ConnectionStatusBadge'
import { useMcpStatus } from '@/hooks/useMcpConnection'

const NAV_ITEMS = [
  { to: '/workspaces', label: 'Workspaces', icon: FolderSearch },
  { to: '/playbooks', label: 'Playbooks', icon: BookOpenCheck },
  { to: '/matter-fields', label: 'Matter Fields', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  const { data: status } = useMcpStatus()
  const location = useLocation()

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            AM
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            AI Matters
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={location.pathname.startsWith(item.to)}
                  >
                    <NavLink to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavLink to="/settings" className="flex flex-col gap-1.5 rounded-md border border-sidebar-border px-2.5 py-2 text-xs hover:bg-sidebar-accent">
          <span className="font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">iManage Work</span>
          <ConnectionStatusBadge state={status?.state ?? 'not_connected'} className="group-data-[collapsible=icon]:hidden" />
        </NavLink>
      </SidebarFooter>
    </Sidebar>
  )
}
