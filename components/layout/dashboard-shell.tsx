"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { DateDisplay } from "@/components/layout/date-display"
import { NotificationBell } from "@/components/layout/notification-bell"
import { GlobalSearch } from "@/components/layout/global-search"
import { usePathname } from "next/navigation"

interface Props {
  children: React.ReactNode
  userName: string
  userInitial: string
}

const PAGE_TITLES: Record<string, string> = {
  "/":                            "Tableau de bord",
  "/employes":                    "Employés",
  "/conges":                      "Congés & Absences",
  "/disciplinaire":               "Disciplinaire",
  "/disciplinaire/procedures":    "Procédures disciplinaires",
  "/disciplinaire/demandes":      "Demandes d'explication",
  "/disciplinaire/dossiers":      "Dossiers employés",
  "/salaires":                    "Salaires",
  "/evaluations":                 "Évaluations",
  "/horaires":                    "Horaires",
  "/pointage":                    "Pointage QR",
  "/historique":                  "Historique des interactions",
}

export function DashboardShell({ children, userName, userInitial }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const pageTitle = PAGE_TITLES[pathname]
    ?? (pathname.startsWith("/employes/") ? "Fiche employé" : "Mon RH")

  return (
    <div className="flex h-full">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Spacer invisible qui réserve la place de la sidebar fixe sur desktop */}
      <div className="hidden lg:block flex-shrink-0" style={{ width: 260 }} />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(0,0,0,0.07)" }}>

          {/* Accent line top */}
          <div className="h-[2px]"
            style={{ background: "linear-gradient(90deg,#38bdf8,#6366f1,#a78bfa)" }} />

          <div className="h-14 flex items-center justify-between px-4 sm:px-6">

            {/* Left */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger mobile */}
              <button onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0">
                <Menu className="h-5 w-5" />
              </button>

              {/* Titre de page — visible sur tous écrans */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
                <h1 className="text-sm font-semibold text-slate-800 truncate">{pageTitle}</h1>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

              {/* Recherche globale */}
              <GlobalSearch />

              <div className="hidden lg:block h-6 w-px bg-slate-200" />

              {/* Statut système */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-700"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En ligne
              </div>

              {/* Date */}
              <div className="hidden lg:block">
                <DateDisplay />
              </div>

              <div className="hidden lg:block h-6 w-px bg-slate-200" />

              {/* Notifications */}
              <NotificationBell theme="light" />

              <div className="h-6 w-px bg-slate-200" />

              {/* Avatar + nom */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)" }}>
                    {userInitial}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <span className="hidden sm:block text-sm font-semibold text-slate-700 max-w-[130px] truncate">
                  {userName}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Contenu ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="max-w-7xl mx-auto p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
