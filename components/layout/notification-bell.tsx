"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Bell, X, CheckCheck, User, FileText, Send,
  MessageCircle, AlertTriangle, Clock, CalendarCheck, XCircle,
  ChevronRight, Loader2, Star,
} from "lucide-react"

type Notif = {
  id: string
  type: string
  titre: string
  message: string
  lu: boolean
  dossierId: string | null
  createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  DEMANDE_INITIE:      { icon: User,          color: "#f59e0b", bg: "#fffbeb" },
  DOCUMENT_PRET:       { icon: FileText,      color: "#3b82f6", bg: "#eff6ff" },
  ENVOYE_EMPLOYE:      { icon: Send,          color: "#6366f1", bg: "#eef2ff" },
  REPONSE_RECUE:       { icon: MessageCircle, color: "#10b981", bg: "#ecfdf5" },
  SANCTION_AUTO:       { icon: AlertTriangle, color: "#ef4444", bg: "#fef2f2" },
  DELAI_DEPASSE:       { icon: Clock,         color: "#f97316", bg: "#fff7ed" },
  CONGE_APPROUVE:      { icon: CalendarCheck, color: "#10b981", bg: "#ecfdf5" },
  CONGE_REFUSE:        { icon: XCircle,       color: "#ef4444", bg: "#fef2f2" },
  PLANNING_MAJ:        { icon: CalendarCheck, color: "#6366f1", bg: "#eef2ff" },
  EVALUATION_PUBLIEE:  { icon: Star,          color: "#a855f7", bg: "#faf5ff" },
  BULLETIN_DISPONIBLE: { icon: FileText,      color: "#0ea5e9", bg: "#f0f9ff" },
}

// Maps each notification type → URL to navigate to on click
function getHref(n: Notif): string | null {
  switch (n.type) {
    // ── RH / Admin ────────────────────────────────
    case "DEMANDE_INITIE":  return "/conges"
    case "DOCUMENT_PRET":   return n.dossierId ? "/disciplinaire/dossiers" : "/disciplinaire"
    case "ENVOYE_EMPLOYE":  return "/disciplinaire/dossiers"
    case "REPONSE_RECUE":   return "/disciplinaire/dossiers"
    case "SANCTION_AUTO":   return "/disciplinaire/procedures"
    case "DELAI_DEPASSE":   return "/disciplinaire/dossiers"
    // ── Employé ───────────────────────────────────
    case "CONGE_APPROUVE":      return "/mon-espace/conges"
    case "CONGE_REFUSE":        return "/mon-espace/conges"
    case "PLANNING_MAJ":        return "/mon-espace/planning"
    case "EVALUATION_PUBLIEE":  return "/mon-espace/evaluations"
    case "BULLETIN_DISPONIBLE": return "/mon-espace/salaires"
    default:                    return null
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)  return `Il y a ${d}j`
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function NotificationBell({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const router                  = useRouter()
  const [notifs, setNotifs]     = useState<Notif[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [marking, setMarking]   = useState(false)
  const ref                     = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.lu).length

  const fetchNotifs = useCallback(async () => {
    const res = await fetch("/api/notifications")
    if (res.ok) setNotifs(await res.json())
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchNotifs().finally(() => setLoading(false))
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifs])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  async function markRead(ids: string[]) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setNotifs(prev => prev.map(n => ids.includes(n.id) ? { ...n, lu: true } : n))
  }

  async function markAll() {
    setMarking(true)
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
    setMarking(false)
  }

  async function handleNotifClick(n: Notif) {
    // Mark as read first (fire-and-forget)
    if (!n.lu) markRead([n.id])

    const href = getHref(n)
    if (href) {
      setOpen(false)
      router.push(href)
    }
  }

  function handleOpen() {
    setOpen(o => !o)
  }

  const textColor = theme === "light"
    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
    : "text-white/80 hover:text-white hover:bg-white/10"

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={`relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${textColor} ${open ? (theme === "light" ? "bg-slate-100" : "bg-white/10") : ""}`}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin opacity-60" />
          : <Bell className="h-4 w-4" />
        }
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-black leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown — fixed (plein écran) sur mobile, absolu sur sm+ */}
      {open && (
        <div className="fixed right-2 left-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 z-[60] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-600" />
              <p className="font-semibold text-slate-900 text-sm">Notifications</p>
              {unread > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                  {unread} non lue{unread > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAll}
                  disabled={marking}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                  Tout lire
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[60vh]"
            style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
            {notifs.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">Aucune notification</p>
                <p className="text-xs text-slate-300 mt-1">Vous êtes à jour !</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifs.map(n => {
                  const cfg      = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.DEMANDE_INITIE
                  const Icon     = cfg.icon
                  const href     = getHref(n)
                  const isLink   = !!href

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3.5 transition-colors group ${
                        n.lu
                          ? isLink
                            ? "bg-white hover:bg-slate-50 cursor-pointer"
                            : "bg-white cursor-default"
                          : isLink
                            ? "bg-blue-50/40 hover:bg-blue-50/80 cursor-pointer"
                            : "bg-blue-50/40 cursor-default"
                      }`}
                    >
                      {/* Type icon */}
                      <div
                        className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: cfg.bg }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${n.lu ? "text-slate-700" : "text-slate-900 font-semibold"}`}>
                            {n.titre}
                          </p>
                          {!n.lu && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 text-left">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}</p>
                          {isLink && (
                            <span className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              Voir
                              <ChevronRight className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      {isLink && (
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 self-center transition-colors" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {notifs.length} notification{notifs.length > 1 ? "s" : ""}
              </p>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  disabled={marking}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
