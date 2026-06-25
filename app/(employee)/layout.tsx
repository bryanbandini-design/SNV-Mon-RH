"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Menu, X, LayoutDashboard, User, DollarSign, Calendar, Clock,
  Star, FolderOpen, LogOut, Timer, BarChart3,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { NotificationBell } from "@/components/layout/notification-bell"
import { cn } from "@/lib/utils"

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { href: "/mon-espace", label: "Tableau de bord", icon: LayoutDashboard, exact: true,
        iconColor: "text-sky-300",    activeColor: "bg-sky-400/20"    },
    ],
  },
  {
    label: "Temps & présence",
    items: [
      { href: "/mon-espace/pointage", label: "Mon pointage",  icon: Timer,     exact: false,
        iconColor: "text-emerald-300", activeColor: "bg-emerald-400/20" },
      { href: "/mon-espace/planning", label: "Mon planning",  icon: Calendar,  exact: false,
        iconColor: "text-indigo-300",  activeColor: "bg-indigo-400/20"  },
      { href: "/mon-espace/horaires", label: "Mes horaires",  icon: BarChart3, exact: false,
        iconColor: "text-violet-300",  activeColor: "bg-violet-400/20"  },
    ],
  },
  {
    label: "Ma carrière",
    items: [
      { href: "/mon-espace/profil",      label: "Mon profil",      icon: User,     exact: false,
        iconColor: "text-blue-300",   activeColor: "bg-blue-400/20"   },
      { href: "/mon-espace/conges",      label: "Mes congés",      icon: Clock,    exact: false,
        iconColor: "text-amber-300",  activeColor: "bg-amber-400/20"  },
      { href: "/mon-espace/evaluations", label: "Mes évaluations", icon: Star,     exact: false,
        iconColor: "text-purple-300", activeColor: "bg-purple-400/20" },
    ],
  },
  {
    label: "Administratif",
    items: [
      { href: "/mon-espace/salaires",  label: "Mes salaires",  icon: DollarSign, exact: false,
        iconColor: "text-green-300",  activeColor: "bg-green-400/20"  },
      { href: "/mon-espace/documents", label: "Mes documents", icon: FolderOpen, exact: false,
        iconColor: "text-orange-300", activeColor: "bg-orange-400/20" },
    ],
  },
]

function EmployeeSidebar({ open, onClose, employe }: {
  open: boolean
  onClose: () => void
  employe: { prenom: string; nom: string; poste: string; departement: string | null } | null
}) {
  const pathname = usePathname()

  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      document.body.style.touchAction = "none"
    } else {
      document.body.style.overflow = ""
      document.body.style.touchAction = ""
    }
    return () => {
      document.body.style.overflow = ""
      document.body.style.touchAction = ""
    }
  }, [open])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          style={{ touchAction: "none" }} />
      )}
      <aside className={cn(
        "fixed left-0 top-0 w-64 flex flex-col z-50 transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
        style={{
          height: "100dvh",
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "linear-gradient(170deg, #064e3b 0%, #065f46 45%, #047857 100%)",
        }}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Logo */}
        <div className="pt-5 pb-4 flex items-center justify-center relative border-b border-white/10">
          <button onClick={onClose}
            className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            display: "flex", alignItems: "center",
            boxShadow: "0 0 0 1.5px rgba(255,255,255,0.3), 0 0 10px rgba(255,255,255,0.65), 0 0 22px rgba(255,255,255,0.32), 0 0 38px rgba(255,255,255,0.14)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-sanovia.png" alt="SANOVIA Health Care"
              style={{ height: "70px", width: "auto", display: "block", maxWidth: "none" }} />
          </div>
        </div>

        {/* Avatar employé */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-inner">
              {employe?.prenom?.[0]}{employe?.nom?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate leading-tight">{employe?.prenom} {employe?.nom}</p>
              <p className="text-emerald-300 text-xs truncate mt-0.5">{employe?.poste}</p>
              {employe?.departement && (
                <span className="inline-block text-[10px] text-emerald-400/80 bg-white/10 rounded-full px-2 py-0.5 mt-1">
                  {employe.departement}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation par sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400/60 px-2 mb-2">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                        active
                          ? `${item.activeColor} text-white shadow-sm`
                          : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                      )}>
                      <div className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                        active ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
                      )}>
                        <item.icon className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          active ? "text-white" : item.iconColor
                        )} />
                      </div>
                      <span className="truncate">{item.label}</span>
                      {active && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70 flex-shrink-0" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pied de sidebar */}
        <div className="px-3 py-3 border-t border-white/10">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-300/80 hover:bg-white/10 hover:text-white transition-all group"
          >
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 group-hover:bg-white/10 flex-shrink-0">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [employe, setEmploye] = useState<{ prenom: string; nom: string; poste: string; departement: string | null } | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/login"
      return
    }
    if (status === "authenticated") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const role      = (session?.user as any)?.role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const employeId = (session?.user as any)?.employeId
      if (role !== "EMPLOYE" || !employeId) {
        window.location.href = "/"
        return
      }
      fetch(`/api/mon-espace/profil`).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.employe) setEmploye(d.employe)
      })
    }
  }, [status, session])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <EmployeeSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} employe={employe} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 w-full min-w-0">
        <header className="sticky top-0 z-20 h-14 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500 font-medium">Mon espace personnel</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <p className="hidden md:block text-xs text-slate-400">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <NotificationBell theme="light" />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
