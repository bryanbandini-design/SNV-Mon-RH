"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { DateDisplay } from "@/components/layout/date-display"
import { NotificationBell } from "@/components/layout/notification-bell"

interface Props {
  children: React.ReactNode
  userName: string
  userInitial: string
}

export function DashboardShell({ children, userName, userInitial }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Main content — shifts right on desktop to clear sidebar */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[260px] w-full min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500 font-medium">Système en ligne</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:block">
              <DateDisplay />
            </div>
            <div className="hidden md:block h-8 w-px bg-slate-200" />
            <NotificationBell theme="light" />
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
              >
                {userInitial}
              </div>
              <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">{userName}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
