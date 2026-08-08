"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { RecentChatList } from "./recent-chat-list";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceNavChatList } from "./workspace-nav-chat-list";
import { WorkspaceUserInfo } from "./workspace-user-info";

export function WorkspaceSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { open: isSidebarOpen, state } = useSidebar();
  return (
    <>
      <Sidebar variant="sidebar" collapsible="offcanvas" {...props}>
        <SidebarHeader className="pt-10 pb-0">
          <WorkspaceHeader />
        </SidebarHeader>
        <SidebarContent>
          <WorkspaceNavChatList />
          {isSidebarOpen && <RecentChatList />}
        </SidebarContent>
        <SidebarFooter>
          <WorkspaceUserInfo />
        </SidebarFooter>
        <SidebarRail />
        <SidebarResizeHandle collapsed={state === "collapsed"} />
      </Sidebar>
    </>
  );
}
