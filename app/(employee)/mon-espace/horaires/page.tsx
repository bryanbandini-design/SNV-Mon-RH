"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, Clock, TrendingUp, Calendar, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

type Presence = {
  id: string
  date: string
  heureArrivee: string | null
  heureDepart:  string | null
  heuresTravaillees: number | null
  minutesRetard: number
  statut: string
  statutValidation: string
  notes: string | null
}

type Stats = {
  heuresMois: number
  heuresSemaine: number
  joursPresents: number
  retards: number
  moyenneParJour: number
}

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

function fmtHours(h: number) {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  if (min === 0) return `${hrs}h`
  return `${hrs}h${min.toString().padStart(2, "0")}`
}

function moisStr(y: number, m: number) {
  return `${y}-${m.toString().padStart(2, "0")}`
}

export default function MesHorairesPage() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [presences, setPresences] = useState<Presence[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)

  const fetch_ = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const res = await fetch(`/api/mon-espace/horaires?mois=${moisStr(y, m)}`)
    if (res.ok) {
      const d = await res.json()
      setPresences(d.presences)
      setStats(d.stats)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch_(year, month) }, [fetch_, year, month])

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function next() {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const statCards = stats ? [
    { label: "Cette semaine",    value: fmtHours(stats.heuresSemaine), icon: Clock,       color: "#6366f1", bg: "#eef2ff" },
    { label: `${MOIS_FR[month - 1]}`,  value: fmtHours(stats.heuresMois),    icon: BarChart3,   color: "#10b981", bg: "#ecfdf5" },
    { label: "Jours présents",   value: stats.joursPresents.toString(),        icon: CheckCircle2,color: "#3b82f6", bg: "#eff6ff" },
    { label: "Moy. par jour",    value: fmtHours(stats.moyenneParJour),        icon: TrendingUp,  color: "#8b5cf6", bg: "#f5f3ff" },
  ] : []

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes horaires</h1>
        <p className="text-sm text-slate-500 mt-1">Historique de vos heures travaillées validées par votre responsable</p>
      </div>

      {/* Sélecteur de mois */}
      <div className="flex items-center gap-3">
        <button onClick={prev}
          className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="font-bold text-slate-900">{MOIS_FR[month - 1]} {year}</p>
          {isCurrentMonth && <p className="text-xs text-emerald-600 font-medium">Mois en cours</p>}
        </div>
        <button onClick={next} disabled={isCurrentMonth}
          className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(c => (
            <div key={c.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-3"
                style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <p className="text-xl font-black text-slate-900">{c.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerte retards */}
      {stats && stats.retards > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{stats.retards} retard{stats.retards > 1 ? "s" : ""}</span> enregistré{stats.retards > 1 ? "s" : ""} ce mois-ci.
          </p>
        </div>
      )}

      {/* Liste des présences */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <p className="font-semibold text-slate-900 text-sm">
            Détail — {MOIS_FR[month - 1]} {year}
          </p>
          {!loading && (
            <span className="ml-auto text-xs text-slate-400">{presences.length} jour{presences.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : presences.length === 0 ? (
          <div className="text-center py-14">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-400">Aucune présence validée ce mois-ci</p>
            <p className="text-xs text-slate-300 mt-1">Les pointages validés par votre responsable apparaîtront ici</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {presences.map(p => {
              const isRetard  = p.statut === "RETARD"
              const dateLabel = new Date(p.date).toLocaleDateString("fr-FR", {
                weekday: "short", day: "numeric", month: "short",
              })
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Indicateur statut */}
                    <div className={`h-8 w-1.5 rounded-full flex-shrink-0 ${
                      isRetard ? "bg-amber-400" : "bg-emerald-400"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 capitalize">{dateLabel}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {p.heureArrivee ?? "--:--"} → {p.heureDepart ?? "--:--"}
                      </p>
                      {isRetard && p.minutesRetard > 0 && (
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                          Retard : {p.minutesRetard} min
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    {/* Heures travaillées */}
                    {p.heuresTravaillees !== null && p.heuresTravaillees > 0 && (
                      <div className="text-right">
                        <p className="text-base font-black text-slate-800">
                          {fmtHours(p.heuresTravaillees)}
                        </p>
                        <p className="text-[10px] text-slate-400">travaillées</p>
                      </div>
                    )}
                    {/* Badge statut */}
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      isRetard
                        ? "bg-amber-50 text-amber-600 border border-amber-200"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    }`}>
                      {isRetard ? "Retard" : "Présent"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note informative */}
      {!loading && (
        <p className="text-xs text-slate-400 text-center">
          Seules les présences validées par votre responsable sont comptabilisées.
          Pour contester un pointage, contactez votre responsable de shift.
        </p>
      )}
    </div>
  )
}
