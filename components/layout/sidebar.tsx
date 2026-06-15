"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Users, Calendar, AlertTriangle, DollarSign,
  LayoutDashboard, LogOut, TrendingUp, Clock, ChevronRight,
  Bell, X, Check, ShieldOff, ChevronDown,
  FileText, FolderOpen, MessageSquareWarning,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

type Notif    = { id: string; type: string; titre: string; message: string; lu: boolean; dossierId?: string | null; createdAt: string }
type NavChild = { name: string; href: string; icon: React.ElementType }
type NavItem  = { name: string; href: string; icon: React.ElementType; color: string; children?: NavChild[] }

const navigation: NavItem[] = [
  { name: "Tableau de bord",  href: "/",               icon: LayoutDashboard, color: "text-blue-400"    },
  { name: "Employés",          href: "/employes",        icon: Users,           color: "text-sky-400"     },
  { name: "Congés & Absences", href: "/conges",          icon: Calendar,        color: "text-amber-400"   },
  {
    name: "Disciplinaire",     href: "/disciplinaire",   icon: AlertTriangle,   color: "text-red-400",
    children: [
      { name: "Procédures",            href: "/disciplinaire/procedures", icon: ShieldOff            },
      { name: "Dem. d'explication",    href: "/disciplinaire/demandes",   icon: MessageSquareWarning },
      { name: "Dossiers employés",     href: "/disciplinaire/dossiers",   icon: FolderOpen           },
    ],
  },
  { name: "Salaires",          href: "/salaires",        icon: DollarSign,      color: "text-emerald-400" },
  { name: "Évaluations",       href: "/evaluations",     icon: TrendingUp,      color: "text-purple-400"  },
  { name: "Horaires",          href: "/horaires",        icon: Clock,           color: "text-indigo-400"  },
]

const NOTIF_COLOR: Record<string, string> = {
  DEMANDE_INITIE: "#3b82f6", DOCUMENT_PRET: "#8b5cf6",
  ENVOYE_EMPLOYE: "#f59e0b", REPONSE_RECUE: "#10b981",
  SANCTION_AUTO:  "#ef4444", DELAI_DEPASSE:  "#dc2626",
}

function timeAgo(date: string): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60)    return "À l'instant"
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return `Il y a ${Math.floor(diff / 86400)} j`
}

function NotificationPanel({ notifs, onClose, onMarkAll }: {
  notifs: Notif[]; onClose: () => void; onMarkAll: () => void
}) {
  return (
    <div className="absolute left-0 lg:left-[260px] bottom-4 z-50 w-80 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <p className="text-sm font-semibold text-white">Notifications</p>
        <div className="flex items-center gap-2">
          {notifs.some(n => !n.lu) && (
            <button onClick={onMarkAll} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
              <Check className="h-3 w-3" /> Tout lire
            </button>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {notifs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">Aucune notification</div>
        ) : notifs.map(n => (
          <div key={n.id}
            className={`px-4 py-3 border-b border-slate-700/60 ${!n.lu ? "bg-slate-700/40" : ""}`}>
            <div className="flex items-start gap-2.5">
              <div className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: NOTIF_COLOR[n.type] ?? "#64748b", opacity: n.lu ? 0.3 : 1 }} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${n.lu ? "text-slate-400" : "text-white"}`}>{n.titre}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-xs text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {notifs.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-700 flex-shrink-0">
          <Link href="/disciplinaire/procedures" onClick={onClose}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            <ShieldOff className="h-3 w-3" /> Voir les procédures
          </Link>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ mobileOpen, onMobileClose }: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const pathname          = usePathname()
  const { data: session } = useSession()

  const [notifs,     setNotifs]     = useState<Notif[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [discOpen,   setDiscOpen]   = useState(() => pathname.startsWith("/disciplinaire"))
  const notifRef                    = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role     = (session?.user as any)?.role ?? ""
  const initial  = session?.user?.name?.[0]?.toUpperCase() ?? "A"
  const userName = session?.user?.name ?? "Administrateur"
  const unread   = notifs.filter(n => !n.lu).length

  useEffect(() => {
    if (pathname.startsWith("/disciplinaire")) setDiscOpen(true)
  }, [pathname])

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const loadNotifs = useCallback(() => {
    fetch("/api/notifications")
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setNotifs(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadNotifs()
    const t = setInterval(loadNotifs, 30_000)
    return () => clearInterval(t)
  }, [loadNotifs])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    if (showNotifs) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showNotifs])

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  function roleLabel() {
    if (role === "ADMIN")       return "Administrateur"
    if (role === "RH")          return "Ressources Humaines"
    if (role === "RESPONSABLE") return "Responsable"
    return "Utilisateur"
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "flex h-screen flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out",
          // Mobile: slide in/out
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)", width: "260px" }}
      >
        {/* Logo + close button (mobile) */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
              <span className="text-white font-black text-base tracking-tight">RH</span>
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight">Mon RH</p>
              <p className="text-xs text-slate-500 leading-tight">Ressources Humaines</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden text-slate-500 hover:text-slate-200 transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-5 border-t border-slate-800" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 pb-2">Menu</p>

          {navigation.map((item) => {
            const isActive   = pathname === item.href || (item.href !== "/" && !item.children && pathname.startsWith(item.href))
            const isDiscZone = item.children && pathname.startsWith(item.href)

            if (item.children) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setDiscOpen(v => !v)}
                    className={cn(
                      "w-full group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 border",
                      isDiscZone
                        ? "bg-red-600/10 text-red-300 border-red-500/20"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 flex-shrink-0 transition-colors",
                      isDiscZone ? "text-red-400" : `${item.color} opacity-70 group-hover:opacity-100`
                    )} />
                    <span className="flex-1 text-left truncate">{item.name}</span>
                    {unread > 0 && (
                      <span className="h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200",
                      discOpen ? "rotate-180" : ""
                    )} />
                  </button>
                  <div className={cn(
                    "overflow-hidden transition-all duration-200",
                    discOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  )}>
                    <div className="ml-4 mt-0.5 pl-3 border-l border-slate-800 space-y-0.5 pb-1">
                      {item.children.map(child => {
                        const childActive = pathname === child.href || pathname.startsWith(child.href)
                        return (
                          <Link key={child.href} href={child.href}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                              childActive
                                ? "bg-red-600/20 text-red-300"
                                : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                            )}
                          >
                            <child.icon className={cn("h-3.5 w-3.5 flex-shrink-0", childActive ? "text-red-400" : "text-slate-600")} />
                            {child.name}
                            {childActive && <ChevronRight className="h-3 w-3 ml-auto text-red-400" />}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <Link key={item.name} href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 border mt-0.5",
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border-blue-500/20"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-colors",
                  isActive ? "text-blue-400" : `${item.color} opacity-70 group-hover:opacity-100`
                )} />
                <span className="flex-1 truncate">{item.name}</span>
                {isActive && <ChevronRight className="h-3 w-3 text-blue-400 flex-shrink-0" />}
              </Link>
            )
          })}
        </nav>

        <div className="mx-5 border-t border-slate-800" />

        {/* Profil + Notifications */}
        <div className="px-3 py-4 space-y-1 relative" ref={notifRef}>
          {showNotifs && (
            <NotificationPanel notifs={notifs} onClose={() => setShowNotifs(false)} onMarkAll={markAll} />
          )}

          <button
            onClick={() => { setShowNotifs(v => !v); if (!showNotifs) loadNotifs() }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              showNotifs ? "bg-slate-700/60 text-slate-200" : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
            )}
          >
            <div className="relative">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <span className="flex-1 text-left">Notifications</span>
          </button>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/40">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{userName}</p>
              <p className="text-xs text-slate-500">{roleLabel()}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-950/40 hover:text-red-400 transition-all duration-150 group"
          >
            <LogOut className="h-4 w-4 group-hover:text-red-400 transition-colors" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
