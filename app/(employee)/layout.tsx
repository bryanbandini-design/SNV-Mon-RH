"use client"

// Employee layout is a client component to handle mobile sidebar state
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Menu, X, LayoutDashboard, User, DollarSign, Calendar, Clock, Star, FolderOpen, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { NotificationBell } from "@/components/layout/notification-bell"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/mon-espace",             label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/mon-espace/profil",      label: "Mon profil",      icon: User            },
  { href: "/mon-espace/salaires",    label: "Mes salaires",    icon: DollarSign      },
  { href: "/mon-espace/conges",      label: "Mes congés",      icon: Calendar        },
  { href: "/mon-espace/planning",    label: "Mon planning",    icon: Clock           },
  { href: "/mon-espace/evaluations", label: "Mes évaluations", icon: Star            },
  { href: "/mon-espace/documents",   label: "Mes documents",   icon: FolderOpen      },
]

function EmployeeSidebar({ open, onClose, employe }: {
  open: boolean
  onClose: () => void
  employe: { prenom: string; nom: string; poste: string; departement: string | null } | null
}) {
  const pathname = usePathname()

  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-emerald-900 to-emerald-800 flex flex-col z-50 transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-emerald-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-sm">M</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Mon RH</p>
              <p className="text-emerald-300 text-[10px] mt-0.5">Espace employé</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-emerald-300 hover:text-white transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-5 py-5 border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-base flex-shrink-0">
              {employe?.prenom?.[0]}{employe?.nom?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{employe?.prenom} {employe?.nom}</p>
              <p className="text-emerald-300 text-xs truncate">{employe?.poste}</p>
              {employe?.departement && <p className="text-emerald-400 text-[10px] truncate">{employe.departement}</p>}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                  active
                    ? "bg-white/20 text-white"
                    : "text-emerald-100 hover:bg-white/10 hover:text-white"
                )}>
                <item.icon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-colors",
                  active ? "text-white" : "text-emerald-300 group-hover:text-white"
                )} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-emerald-700/50">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-300 hover:bg-white/10 hover:text-white transition-all group"
          >
            <LogOut className="h-4 w-4 flex-shrink-0 group-hover:text-white transition-colors" />
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
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>{children}</div>
        </main>
      </div>
    </div>
  )
}
