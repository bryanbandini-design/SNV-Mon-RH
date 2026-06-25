"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  History, Search, Filter, RefreshCw, Users, LogIn, UserPlus,
  Edit, Trash2, CheckCircle, XCircle, DollarSign, ScanLine, Upload,
  ChevronLeft, ChevronRight, Download,
} from "lucide-react"

interface ActivityLog {
  id: string
  userId?: string
  userName?: string
  userRole?: string
  action: string
  module: string
  description: string
  entityId?: string
  entityType?: string
  metadata?: string
  createdAt: string
}

interface Stats {
  total: number
  totalPages: number
  page: number
  byModule: { module: string; _count: { id: number } }[]
  users: { userId: string; userName: string; userRole: string; _count: { id: number } }[]
  logs: ActivityLog[]
}

// ── Config visuelle ───────────────────────────────────────────────────────────

const MODULE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AUTH:         { label: "Authentification", color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  EMPLOYES:     { label: "Employés",         color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  CONGES:       { label: "Congés",           color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  SALAIRES:     { label: "Salaires",         color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  EVALUATIONS:  { label: "Évaluations",      color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  DISCIPLINAIRE:{ label: "Disciplinaire",    color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  POINTAGE:     { label: "Pointage",         color: "#22d3ee", bg: "rgba(34,211,238,0.1)" },
  HORAIRES:     { label: "Horaires",         color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
  DOCUMENTS:    { label: "Documents",        color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  LOGIN:               { label: "Connexion",        icon: <LogIn size={13} />,       color: "#38bdf8" },
  LOGOUT:              { label: "Déconnexion",       icon: <LogIn size={13} />,       color: "#94a3b8" },
  CREATE:              { label: "Création",          icon: <UserPlus size={13} />,    color: "#22c55e" },
  UPDATE:              { label: "Modification",      icon: <Edit size={13} />,        color: "#f59e0b" },
  DELETE:              { label: "Suppression",       icon: <Trash2 size={13} />,      color: "#ef4444" },
  APPROVE:             { label: "Approbation",       icon: <CheckCircle size={13} />, color: "#22c55e" },
  REJECT:              { label: "Refus",             icon: <XCircle size={13} />,     color: "#ef4444" },
  UPLOAD:              { label: "Upload",            icon: <Upload size={13} />,      color: "#8b5cf6" },
  ENROLL_FACE:         { label: "Enrol. facial",     icon: <Users size={13} />,       color: "#06b6d4" },
  POINTAGE_ENTREE:     { label: "Arrivée",           icon: <ScanLine size={13} />,    color: "#10b981" },
  POINTAGE_CONFIRME:   { label: "Présence conf.",    icon: <ScanLine size={13} />,    color: "#22d3ee" },
  POINTAGE_SORTIE:     { label: "Départ",            icon: <ScanLine size={13} />,    color: "#6b7280" },
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin", RH: "RH", RESPONSABLE: "Responsable", EMPLOYE: "Employé",
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60)    return "À l'instant"
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `Il y a ${Math.floor(diff / 86400)} j`
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

interface DailyStats {
  total: number
  byAction: Record<string, number>
  byModule: Record<string, number>
}

export default function HistoriquePage() {
  const [data, setData]       = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [q, setQ]             = useState("")
  const [module, setModule]   = useState("")
  const [action, setAction]   = useState("")
  const [userId, setUserId]   = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo]     = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null)
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  const fetchData = useCallback(async (overridePage = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(overridePage) })
    if (module)   params.set("module", module)
    if (action)   params.set("action", action)
    if (userId)   params.set("userId", userId)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo)   params.set("dateTo", dateTo)
    if (q)        params.set("q", q)

    const res = await fetch(`/api/historique?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [page, module, action, userId, dateFrom, dateTo, q])

  useEffect(() => { fetchData() }, [fetchData])

  // Résumé du jour
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    fetch(`/api/historique?dateFrom=${today}&dateTo=${today}&page=1`)
      .then(r => r.json())
      .then((d: Stats) => {
        const byAction: Record<string, number> = {}
        const byModule: Record<string, number> = {}
        d.logs.forEach(l => {
          byAction[l.action] = (byAction[l.action] ?? 0) + 1
          byModule[l.module] = (byModule[l.module] ?? 0) + 1
        })
        setDailyStats({ total: d.total, byAction, byModule })
      })
  }, [])

  function handleSearch(val: string) {
    setQ(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setPage(1); fetchData(1) }, 400)
  }

  function applyFilter() { setPage(1); fetchData(1) }
  function reset() {
    setQ(""); setModule(""); setAction(""); setUserId(""); setDateFrom(""); setDateTo("")
    setPage(1)
  }

  const todayCount = data?.logs.filter(l =>
    new Date(l.createdAt).toDateString() === new Date().toDateString()
  ).length ?? 0

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Historique des interactions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Toutes les actions effectuées sur la plateforme</p>
        </div>
        <button onClick={() => fetchData()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <RefreshCw size={15} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Actions totales",    value: data.total,                                    color: "#6366f1" },
            { label: "Aujourd'hui",        value: todayCount,                                    color: "#22c55e" },
            { label: "Modules actifs",     value: data.byModule.length,                          color: "#f59e0b" },
            { label: "Utilisateurs",       value: data.users.filter(u => u.userId).length,       color: "#38bdf8" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Résumé du jour */}
      {dailyStats && dailyStats.total > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Activité d&apos;aujourd&apos;hui</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {dailyStats.total} action{dailyStats.total > 1 ? "s" : ""} enregistrée{dailyStats.total > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Aujourd&apos;hui
            </div>
          </div>

          {/* Par module */}
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(dailyStats.byModule)
              .sort((a, b) => b[1] - a[1])
              .map(([mod, count]) => {
                const cfg = MODULE_CONFIG[mod]
                return (
                  <button key={mod}
                    onClick={() => { setModule(mod); setPage(1) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm"
                    style={{ background: cfg?.bg ?? "rgba(100,116,139,0.08)", borderColor: cfg?.color ?? "#94a3b8", color: cfg?.color ?? "#64748b" }}>
                    {cfg?.label ?? mod}
                    <span className="font-bold">{count}</span>
                  </button>
                )
              })}
          </div>

          {/* Par action */}
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
            {Object.entries(dailyStats.byAction)
              .sort((a, b) => b[1] - a[1])
              .map(([act, count]) => {
                const cfg = ACTION_CONFIG[act]
                return (
                  <span key={act}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "rgba(0,0,0,0.04)", color: cfg?.color ?? "#64748b" }}>
                    {cfg?.icon}
                    {cfg?.label ?? act}
                    <span className="font-bold ml-0.5">{count}</span>
                  </span>
                )
              })}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Recherche */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium text-slate-600 block mb-1">Recherche</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => handleSearch(e.target.value)}
                placeholder="Nom, description…"
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800" />
            </div>
          </div>

          {/* Module */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Module</label>
            <select value={module} onChange={e => { setModule(e.target.value); setPage(1) }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white">
              <option value="">Tous</option>
              {Object.entries(MODULE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Action</label>
            <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white">
              <option value="">Toutes</option>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Utilisateur */}
          {data && data.users.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Utilisateur</label>
              <select value={userId} onChange={e => { setUserId(e.target.value); setPage(1) }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white">
                <option value="">Tous</option>
                {data.users.map(u => (
                  <option key={u.userId} value={u.userId}>{u.userName} ({u._count.id})</option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Du</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Au</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700" />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button onClick={reset}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 transition-colors">
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Répartition par module */}
        {data && data.byModule.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {data.byModule.map(m => {
              const cfg = MODULE_CONFIG[m.module]
              return (
                <button key={m.module}
                  onClick={() => { setModule(module === m.module ? "" : m.module); setPage(1) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                  style={module === m.module
                    ? { background: cfg?.bg, borderColor: cfg?.color, color: cfg?.color }
                    : { borderColor: "#e2e8f0", color: "#64748b" }}>
                  {cfg?.label ?? m.module}
                  <span className="font-bold">{m._count.id}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Liste des logs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-800">
              {loading ? "Chargement…" : `${data?.total ?? 0} entrée${(data?.total ?? 0) > 1 ? "s" : ""}`}
            </span>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span>Page {page} / {data.totalPages}</span>
              <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Chargement…</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="py-20 text-center">
            <History size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm">Aucune interaction trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.logs.map(log => {
              const moduleCfg = MODULE_CONFIG[log.module]
              const actionCfg = ACTION_CONFIG[log.action]
              const isExpanded = expanded === log.id
              const meta = log.metadata ? (() => { try { return JSON.parse(log.metadata) } catch { return null } })() : null

              return (
                <div key={log.id}
                  className="px-6 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : log.id)}>
                  <div className="flex items-start gap-4">
                    {/* Icône action */}
                    <div className="mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: actionCfg ? `${actionCfg.color}18` : "#f1f5f9", color: actionCfg?.color ?? "#64748b" }}>
                      {actionCfg?.icon ?? <History size={13} />}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {/* Module badge */}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: moduleCfg?.bg ?? "#f1f5f9", color: moduleCfg?.color ?? "#64748b" }}>
                          {moduleCfg?.label ?? log.module}
                        </span>

                        {/* Action badge */}
                        <span className="text-[11px] font-medium text-slate-500">
                          {actionCfg?.label ?? log.action}
                        </span>

                        {/* Utilisateur */}
                        {log.userName && (
                          <span className="text-[11px] text-slate-400">
                            par <span className="font-medium text-slate-600">{log.userName}</span>
                            {log.userRole && (
                              <span className="ml-1 text-[10px] text-slate-400">({ROLE_LABELS[log.userRole] ?? log.userRole})</span>
                            )}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-800 leading-snug">{log.description}</p>

                      {/* Metadata expandée */}
                      {isExpanded && meta && (
                        <div className="mt-3 p-3 rounded-xl text-xs font-mono text-slate-500 bg-slate-50 border border-slate-100">
                          {Object.entries(meta).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-slate-400 w-28 flex-shrink-0">{k}</span>
                              <span className="text-slate-700">{String(v)}</span>
                            </div>
                          ))}
                          {log.entityId && (
                            <div className="flex gap-2 mt-1 pt-1 border-t border-slate-200">
                              <span className="text-slate-400 w-28 flex-shrink-0">ID entité</span>
                              <span className="text-slate-600 break-all">{log.entityId}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-slate-400">{timeAgo(log.createdAt)}</div>
                      <div className="text-[10px] text-slate-300 mt-0.5 hidden sm:block">
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination bas */}
        {data && data.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} sur {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
                <ChevronLeft size={13} />
                Précédent
              </button>
              <button disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">
                Suivant
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
