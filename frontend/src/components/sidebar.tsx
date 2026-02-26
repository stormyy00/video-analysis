"use client";

import { useEffect } from "react";
import { Activity, Plus, Settings } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Sidebar as SidebarCN,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Home, Paperclip, Clock } from "lucide-react";
import type { ElementType } from "react";

export interface NavItem {
  name: string;
  href: string;
  icon: ElementType;
  labeled?: boolean;
}

export const TOP_NAV: NavItem[] = [
  { name: "Home", href: "/", icon: Home },
  { name: "Quotes", href: "/quotes", icon: Paperclip },
  { name: "History", href: "/history", icon: Clock },
];


interface AppSidebarProps {
  onNewParse?: () => void;
  onActivityToggle?: () => void;
  activityOpen?: boolean;
}

const NavIcon = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          className={`
            flex items-center justify-center size-10 rounded-xl transition-colors
            ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }
          `}
        >
          <Icon className="size-[1.15rem]" strokeWidth={1.7} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.name}</TooltipContent>
    </Tooltip>
  );
};

const Sidebar = ({
  onNewParse,
  onActivityToggle,
  activityOpen,
}: AppSidebarProps) => {
  const pathname = useLocation().pathname;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        event.key.toLowerCase() === "u" && (event.metaKey || event.ctrlKey);
      if (!isShortcut) return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget) return;

      event.preventDefault();
      onNewParse?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewParse]);

  return (
    <SidebarCN collapsible="icon">
      <SidebarHeader className="items-center pt-3 pb-0 gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onNewParse}
              className="flex items-center justify-center size-8 rounded-full bg-search-blue text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="size-4" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            New Parse <kbd className="ml-1 text-xs font-medium">⌘ + U</kbd>
          </TooltipContent>
        </Tooltip>

        {TOP_NAV.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={pathname === item.href}
          />
        ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onActivityToggle}
              className={`
            flex items-center justify-center size-10 rounded-xl transition-colors
            ${
              activityOpen
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }
          `}
            >
              <Activity className="size-[1.15rem]" strokeWidth={1.7} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Activity</TooltipContent>
        </Tooltip>
      </SidebarHeader>

      <SidebarFooter className="items-center pb-4 gap-3">
        <NavIcon
          key="settings"
          item={{
            name: "Settings",
            href: "/settings",
            icon: Settings,
          }}
          active={pathname === "/settings"}
        />
      </SidebarFooter>
    </SidebarCN>
  );
};

export default Sidebar;
