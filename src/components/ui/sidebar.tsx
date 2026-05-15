"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Root ────────────────────────────────────────────────────────────────────

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean
}

function Sidebar({ collapsed = false, className, children, ...props }: SidebarProps) {
  return (
    <aside
      data-collapsed={collapsed}
      style={{ width: collapsed ? 64 : 240, transition: "width 300ms cubic-bezier(0.4,0,0.2,1)" }}
      className={cn(
        "group flex flex-col flex-shrink-0 h-screen overflow-hidden",
        "bg-sidebar border-r border-sidebar-border text-sidebar-foreground",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

// ─── Trigger ─────────────────────────────────────────────────────────────────

interface SidebarTriggerProps {
  collapsed: boolean
  onToggle: () => void
  className?: string
}

function SidebarTrigger({ collapsed, onToggle, className }: SidebarTriggerProps) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? "Abrir menu" : "Fechar menu"}
      className={cn(
        "flex items-center justify-center flex-shrink-0",
        "h-8 w-4 rounded-full",
        "bg-sidebar border border-sidebar-border shadow-sm",
        "text-sidebar-foreground/40 hover:text-sidebar-foreground/80",
        "transition-colors duration-150",
        className
      )}
    >
      {collapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
    </button>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function SidebarHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-4 flex-shrink-0", className)} {...props}>
      {children}
    </div>
  )
}

// ─── Content ─────────────────────────────────────────────────────────────────

function SidebarContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex-1 overflow-y-auto overflow-x-hidden px-3 py-2", className)} {...props}>
      {children}
    </div>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function SidebarFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-4 flex-shrink-0",
        "border-t border-sidebar-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Separator ───────────────────────────────────────────────────────────────

function SidebarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-2 border-t border-sidebar-border", className)} {...props} />
}

// ─── Group ───────────────────────────────────────────────────────────────────

function SidebarGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  )
}

function SidebarGroupLabel({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest",
        "text-sidebar-foreground/40 whitespace-nowrap overflow-hidden",
        "group-data-[collapsed=true]:opacity-0 transition-opacity duration-200",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

// ─── Menu ────────────────────────────────────────────────────────────────────

function SidebarMenu({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)} {...props}>
      {children}
    </ul>
  )
}

function SidebarMenuItem({ className, children, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn("", className)} {...props}>
      {children}
    </li>
  )
}

// ─── Menu Button ─────────────────────────────────────────────────────────────

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean
  icon?: React.ReactNode
}

function SidebarMenuButton({ isActive, icon, className, children, ...props }: SidebarMenuButtonProps) {
  return (
    <button
      data-active={isActive}
      className={cn(
        "flex items-center w-full h-10 rounded-lg gap-3 px-3",
        "text-sm font-medium transition-colors duration-150 whitespace-nowrap overflow-hidden",
        "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        "data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
        className
      )}
      {...props}
    >
      {icon && (
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {icon}
        </span>
      )}
      <span className="group-data-[collapsed=true]:opacity-0 transition-opacity duration-200 truncate">
        {children}
      </span>
    </button>
  )
}

// ─── User Info (footer) ───────────────────────────────────────────────────────

interface SidebarUserProps {
  name: string
  email: string
  avatar?: React.ReactNode
  className?: string
}

function SidebarUser({ name, email, avatar, className }: SidebarUserProps) {
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-foreground">
        {avatar ?? name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col min-w-0 group-data-[collapsed=true]:opacity-0 transition-opacity duration-200">
        <span className="text-sm font-medium text-sidebar-foreground truncate">{name}</span>
        <span className="text-xs text-sidebar-foreground/50 truncate">{email}</span>
      </div>
    </div>
  )
}

export {
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarUser,
}
