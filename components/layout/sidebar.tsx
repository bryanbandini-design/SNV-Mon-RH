"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Users, Calendar, AlertTriangle, DollarSign,
  LayoutDashboard, LogOut, TrendingUp, Clock,
  Bell, X, Check, ShieldOff, ChevronDown,
  FileText, FolderOpen, MessageSquareWarning, ScanLine, History,
  UserSearch, GraduationCap, GitBranch, Settings, UserCog, Megaphone,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

import type { PermKey } from "@/lib/permissions"

type Notif    = { id: string; type: string; titre: string; message: string; lu: boolean; createdAt: string }
type NavChild = { name: string; href: string; icon: React.ElementType }
type NavItem  = {
  name: string; href: string; icon: React.ElementType
  color: string; bg: string; glow: string
  perm?: PermKey
  children?: NavChild[]
}

const NAV_SECTIONS = [
  {
    label: "Principal",
    items: [
      { name: "Tableau de bord", href: "/", icon: LayoutDashboard,
        color: "text-sky-400", bg: "bg-sky-400/12", glow: "#38bdf8", perm: "DASHBOARD" as PermKey },
    ],
  },
  {
    label: "Gestion",
    items: [
      { name: "Employés",          href: "/employes",      icon: Users,
        color: "text-blue-400",    bg: "bg-blue-400/12",   glow: "#60a5fa", perm: "EMPLOYES" as PermKey },
      { name: "Congés & Absences", href: "/conges",        icon: Calendar,
        color: "text-amber-400",   bg: "bg-amber-400/12",  glow: "#fbbf24", perm: "CONGES" as PermKey },
      { name: "Disciplinaire",     href: "/disciplinaire", icon: AlertTriangle,
        color: "text-red-400",     bg: "bg-red-400/12",    glow: "#f87171", perm: "DISCIPLINAIRE" as PermKey,
        children: [
          { name: "Procédures",         href: "/disciplinaire/procedures", icon: ShieldOff            },
          { name: "Dem. d'explication", href: "/disciplinaire/demandes",   icon: MessageSquareWarning },
          { name: "Dossiers employés",  href: "/disciplinaire/dossiers",   icon: FolderOpen           },
        ],
      },
      { name: "Salaires", href: "/salaires", icon: DollarSign,
        color: "text-emerald-400", bg: "bg-emerald-400/12", glow: "#34d399", perm: "SALAIRES" as PermKey },
    ],
  },
  {
    label: "Performance",
    items: [
      { name: "Évaluations", href: "/evaluations", icon: TrendingUp,
        color: "text-purple-400", bg: "bg-purple-400/12", glow: "#a78bfa", perm: "EVALUATIONS" as PermKey },
      { name: "Horaires",    href: "/horaires",    icon: Clock,
        color: "text-indigo-400", bg: "bg-indigo-400/12", glow: "#818cf8", perm: "HORAIRES" as PermKey },
      { name: "Pointage QR", href: "/pointage",   icon: ScanLine,
        color: "text-cyan-400", bg: "bg-cyan-400/12", glow: "#22d3ee", perm: "POINTAGE" as PermKey },
      { name: "Historique",  href: "/historique", icon: History,
        color: "text-rose-400", bg: "bg-rose-400/12", glow: "#fb7185", perm: "HISTORIQUE" as PermKey },
    ],
  },
  {
    label: "Talent & RH",
    items: [
      { name: "Recrutement", href: "/recrutement", icon: UserSearch,
        color: "text-orange-400", bg: "bg-orange-400/12", glow: "#fb923c", perm: "RECRUTEMENT" as PermKey,
        children: [
          { name: "Offres d'emploi", href: "/recrutement", icon: FileText },
        ],
      },
      { name: "Formations",   href: "/formations",          icon: GraduationCap,
        color: "text-teal-400", bg: "bg-teal-400/12", glow: "#2dd4bf", perm: "FORMATIONS" as PermKey },
      { name: "Annonces",     href: "/annonces",             icon: Megaphone,
        color: "text-indigo-400", bg: "bg-indigo-400/12", glow: "#818cf8" },
      { name: "Organigramme", href: "/employes/organigramme", icon: GitBranch,
        color: "text-violet-400", bg: "bg-violet-400/12", glow: "#a78bfa", perm: "ORGANIGRAMME" as PermKey },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Paramètres",    href: "/parametres",        icon: Settings,
        color: "text-slate-400", bg: "bg-slate-400/12", glow: "#94a3b8", perm: "PARAMETRES" as PermKey },
      { name: "Utilisateurs",  href: "/admin/utilisateurs", icon: UserCog,
        color: "text-blue-400", bg: "bg-blue-400/12", glow: "#60a5fa", perm: "ADMIN_USERS" as PermKey },
    ],
  },
] as { label: string; items: NavItem[] }[]

const NOTIF_COLOR: Record<string, string> = {
  DEMANDE_INITIE: "#3b82f6", DOCUMENT_PRET:  "#8b5cf6",
  ENVOYE_EMPLOYE: "#f59e0b", REPONSE_RECUE:  "#10b981",
  SANCTION_AUTO:  "#ef4444", DELAI_DEPASSE:  "#dc2626",
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60)    return "À l'instant"
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return `Il y a ${Math.floor(diff / 86400)} j`
}

// ── Panneau notifications ─────────────────────────────────────────────────────

function NotificationPanel({ notifs, onClose, onMarkAll }: {
  notifs: Notif[]; onClose: () => void; onMarkAll: () => void
}) {
  const unread = notifs.filter(n => !n.lu).length
  return (
    <div className="absolute left-0 lg:left-[260px] bottom-4 z-50 w-80 rounded-2xl shadow-2xl max-h-[72vh] flex flex-col overflow-hidden"
      style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-sky-400" />
          <p className="text-sm font-semibold text-white">Notifications</p>
          {unread > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={onMarkAll}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-400 transition-colors px-2 py-1 rounded-lg hover:bg-sky-400/10">
              <Check className="h-3 w-3" /> Tout lire
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* List */}
      <div className="overflow-y-auto flex-1"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
        {notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Bell className="h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-600">Aucune notification</p>
          </div>
        ) : notifs.map(n => (
          <div key={n.id}
            className={cn("px-4 py-3.5 border-b border-white/[0.04] transition-colors",
              !n.lu ? "bg-sky-500/[0.04]" : "hover:bg-white/[0.02]")}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: NOTIF_COLOR[n.type] ?? "#64748b", opacity: n.lu ? 0.3 : 1 }} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold leading-snug", n.lu ? "text-slate-500" : "text-white")}>{n.titre}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-slate-700 mt-1.5">{timeAgo(n.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {notifs.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <Link href="/disciplinaire/procedures" onClick={onClose}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors">
            <ShieldOff className="h-3.5 w-3.5" /> Voir toutes les procédures
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ mobileOpen, onMobileClose }: {
  mobileOpen?: boolean; onMobileClose?: () => void
}) {
  const pathname          = usePathname()
  const { data: session } = useSession()

  const [notifs,     setNotifs]     = useState<Notif[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [discOpen,   setDiscOpen]   = useState(() => pathname.startsWith("/disciplinaire"))
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const notifRef                    = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role        = (session?.user as any)?.role ?? ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = ((session?.user as any)?.permissions ?? []) as PermKey[]

  function canSee(perm?: PermKey) {
    if (!perm) return true
    return permissions.includes(perm)
  }
  const initial  = session?.user?.name?.[0]?.toUpperCase() ?? "A"
  const userName = session?.user?.name ?? "Administrateur"
  const unread   = notifs.filter(n => !n.lu).length

  useEffect(() => { if (pathname.startsWith("/disciplinaire")) setDiscOpen(true) }, [pathname])
  useEffect(() => { onMobileClose?.(); setPendingHref(null) }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent background scroll while mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
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
  }, [mobileOpen])

  const loadNotifs = useCallback(() => {
    fetch("/api/notifications").then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setNotifs(d) }).catch(() => {})
  }, [])

  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 60_000); return () => clearInterval(t) }, [loadNotifs])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    if (showNotifs) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showNotifs])

  async function markAll() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) })
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  function roleLabel() {
    if (role === "ADMIN")       return "Administrateur"
    if (role === "RH")          return "Ressources Humaines"
    if (role === "RESPONSABLE") return "Responsable"
    return "Utilisateur"
  }

  function roleBadgeColor() {
    if (role === "ADMIN")       return { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" }
    if (role === "RH")          return { bg: "rgba(168,85,247,0.15)", color: "#c084fc" }
    if (role === "RESPONSABLE") return { bg: "rgba(16,185,129,0.15)", color: "#34d399" }
    return { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" }
  }

  return (
    <>
      {/* Mobile backdrop — touch-action:none empêche le scroll du fond */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          style={{ touchAction: "none" }}
        />
      )}

      <aside
        className={cn(
          "flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{
          width: "var(--sidebar-w)",
          background: "#080d1a",
          height: "100dvh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Accent line gauche */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "linear-gradient(180deg, #38bdf8 0%, #6366f1 50%, #a78bfa 100%)", opacity: 0.7 }} />

        {/* Glow top-left */}
        <div className="absolute top-0 left-0 w-48 h-48 pointer-events-none"
          style={{ background: "radial-gradient(circle at 0% 0%, rgba(56,189,248,0.12) 0%, transparent 70%)" }} />

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="pt-5 pb-4 flex items-center justify-center relative">
          <button onClick={onMobileClose} className="lg:hidden absolute right-3 top-1 p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.08] transition-all">
            <X className="h-4 w-4" />
          </button>
          {/* Icône fleurs — crop circulaire serré sur les feuilles, pas de fond blanc, néon blanc */}
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            boxShadow: "0 0 0 1.5px rgba(255,255,255,0.3), 0 0 8px rgba(255,255,255,0.65), 0 0 18px rgba(255,255,255,0.32), 0 0 34px rgba(255,255,255,0.14)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-sanovia.png" alt="SANOVIA Health Care"
              style={{ height: "56px", width: "auto", display: "block", maxWidth: "none", marginTop: "-2px" }} />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav
          className="flex-1 px-3 py-3 overflow-y-auto space-y-5"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}
        >
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase px-3 pb-2"
                style={{ color: "rgba(148,163,184,0.35)" }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.filter(item => canSee(item.perm)).map(item => {
                  const isActive   = pathname === item.href || (item.href !== "/" && !item.children && pathname.startsWith(item.href))
                  const isDiscZone = item.children && pathname.startsWith(item.href)
                  const isPending  = pendingHref === item.href || (item.children && item.children.some(c => pendingHref === c.href))
                  const active     = isActive || !!isDiscZone || !!isPending

                  if (item.children) {
                    return (
                      <div key={item.name}>
                        <button
                          onClick={() => setDiscOpen(v => !v)}
                          className="w-full group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
                          style={active ? {
                            background: `${item.glow}18`,
                            boxShadow: `inset 0 0 0 1px ${item.glow}28`,
                          } : undefined}
                        >
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 transition-all",
                            active ? item.bg : "bg-white/[0.04] group-hover:bg-white/[0.07]")}>
                            <item.icon className={cn("h-3.5 w-3.5 transition-colors",
                              active ? item.color : "text-slate-500 group-hover:text-slate-300")} />
                          </div>
                          <span className={cn("flex-1 text-left text-[13px] truncate",
                            active ? "text-white font-semibold" : "text-slate-400 group-hover:text-slate-200")}>
                            {item.name}
                          </span>
                          {unread > 0 && (
                            <span className="h-4.5 min-w-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                          <ChevronDown className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 text-slate-600",
                            discOpen ? "rotate-180" : "")} />
                        </button>

                        <div className={cn("overflow-hidden transition-all duration-200",
                          discOpen ? "max-h-44 opacity-100" : "max-h-0 opacity-0")}>
                          <div className="ml-5 mt-1 pl-3 border-l space-y-0.5 pb-1"
                            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                            {item.children.map(child => {
                              const ca = pathname === child.href || pathname.startsWith(child.href) || pendingHref === child.href
                              return (
                                <Link key={child.href} href={child.href}
                                  onClick={() => setPendingHref(child.href)}
                                  className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                                    ca ? "text-red-300" : "text-slate-500 hover:text-slate-300")}
                                  style={ca ? { background: "rgba(248,113,113,0.1)" } : undefined}>
                                  <child.icon className={cn("h-3.5 w-3.5 flex-shrink-0", ca ? "text-red-400" : "text-slate-700")} />
                                  {child.name}
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
                      onClick={() => setPendingHref(item.href)}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
                      style={active ? {
                        background: `${item.glow}18`,
                        boxShadow: `inset 0 0 0 1px ${item.glow}28`,
                      } : undefined}>
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 transition-all",
                        active ? item.bg : "bg-white/[0.04] group-hover:bg-white/[0.07]")}>
                        <item.icon className={cn("h-3.5 w-3.5 transition-colors",
                          active ? item.color : "text-slate-500 group-hover:text-slate-300")} />
                      </div>
                      <span className={cn("flex-1 text-[13px] truncate",
                        active ? "text-white font-semibold" : "text-slate-400 group-hover:text-slate-200")}>
                        {item.name}
                      </span>
                      {active && (
                        <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: item.glow }} />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Fade bas */}
        <div className="h-px mx-5" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* ── Bas de sidebar ────────────────────────────────────────────── */}
        <div className="px-3 py-3 space-y-1 relative" ref={notifRef}>
          {showNotifs && (
            <NotificationPanel notifs={notifs} onClose={() => setShowNotifs(false)} onMarkAll={markAll} />
          )}

          {/* Notifications */}
          <button
            onClick={() => { setShowNotifs(v => !v); if (!showNotifs) loadNotifs() }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
              showNotifs
                ? "bg-sky-500/10 text-sky-300"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            )}>
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 relative transition-all",
              showNotifs ? "bg-sky-400/15" : "bg-white/[0.04]")}>
              <Bell className={cn("h-3.5 w-3.5", showNotifs ? "text-sky-400" : "text-slate-500")} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#080d1a]">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <span className="flex-1 text-left">Notifications</span>
          </button>

          {/* Carte utilisateur */}
          <div className="rounded-xl p-3 mt-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)" }}>
                  {initial}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#080d1a]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{userName}</p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={roleBadgeColor()}>
                  {roleLabel()}
                </span>
              </div>
            </div>
          </div>

          {/* Déconnexion */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-all group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] group-hover:bg-red-500/15 flex-shrink-0 transition-all">
              <LogOut className="h-3.5 w-3.5 transition-colors group-hover:text-red-400" />
            </div>
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
