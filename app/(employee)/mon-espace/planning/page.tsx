import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { Clock, CalendarDays } from "lucide-react"

type Affectation = {
  id: string
  dateDebut: Date
  dateFin: Date
  shift: {
    id: string
    nom: string
    heureDebut: string
    heureFin: string
    couleur: string
  }
}

function calcHeures(debut: string, fin: string): number {
  const [dh, dm] = debut.split(":").map(Number)
  const [fh, fm] = fin.split(":").map(Number)
  const total = (fh * 60 + fm) - (dh * 60 + dm)
  return Math.round(total / 60)
}

function formatRange(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

function getStatus(aff: Affectation): "past" | "current" | "upcoming" {
  const now = new Date()
  if (new Date(aff.dateFin) < now) return "past"
  if (new Date(aff.dateDebut) <= now && new Date(aff.dateFin) >= now) return "current"
  return "upcoming"
}

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

function getWeekDays(): Date[] {
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const mon   = new Date(today)
  mon.setHours(0, 0, 0, 0)
  mon.setDate(today.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

export default async function MonPlanningPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId as string | null
  if (!employeId) redirect("/login")

  const now = new Date()
  const weekDays = getWeekDays()
  const weekStart = weekDays[0]
  const weekEnd   = weekDays[6]
  weekEnd.setHours(23, 59, 59)

  const [affectations, presences] = await Promise.all([
    prisma.affectationShift.findMany({
      where: { employeId },
      include: { shift: true },
      orderBy: { dateDebut: "asc" },
    }),
    prisma.presence.findMany({
      where: {
        employeId,
        date: { gte: new Date(weekStart.toISOString().split("T")[0] + "T00:00:00"), lte: weekEnd },
      },
      orderBy: { date: "asc" },
    }),
  ])

  const currentAff = affectations.find(a =>
    new Date(a.dateDebut) <= now && new Date(a.dateFin) >= now
  )
  const upcomingAffs = affectations.filter(a => new Date(a.dateDebut) > now)
  const pastAffs     = affectations.filter(a => new Date(a.dateFin) < now)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mon planning</h1>
        <p className="text-sm text-slate-500 mt-1">Vos affectations d&apos;équipe et horaires</p>
      </div>

      {/* Affectation courante */}
      {currentAff ? (
        <div className="rounded-2xl p-6 border-l-4"
          style={{ background: "#f0fdf4", borderColor: currentAff.shift.couleur }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: currentAff.shift.couleur }} />
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Affectation en cours</p>
              </div>
              <h2 className="text-xl font-black text-slate-900">{currentAff.shift.nom}</h2>
              <p className="text-2xl font-mono font-bold mt-1" style={{ color: currentAff.shift.couleur }}>
                {currentAff.shift.heureDebut} → {currentAff.shift.heureFin}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {formatRange(currentAff.dateDebut)} — {formatRange(currentAff.dateFin)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-slate-900">{calcHeures(currentAff.shift.heureDebut, currentAff.shift.heureFin)}h</p>
              <p className="text-xs text-slate-400">par jour</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">Pas d&apos;affectation en cours cette semaine</p>
        </div>
      )}

      {/* Vue semaine */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Semaine en cours</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {weekDays[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {weekDays[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="overflow-x-auto">
        <div className="grid grid-cols-7 divide-x divide-slate-100 min-w-[560px]">
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === now.toDateString()
            const dayStr  = day.toISOString().split("T")[0]
            const hasAff  = affectations.some(a => {
              const s = new Date(a.dateDebut).toISOString().split("T")[0]
              const e = new Date(a.dateFin).toISOString().split("T")[0]
              return dayStr >= s && dayStr <= e
            })
            const aff = affectations.find(a => {
              const s = new Date(a.dateDebut).toISOString().split("T")[0]
              const e = new Date(a.dateFin).toISOString().split("T")[0]
              return dayStr >= s && dayStr <= e
            })
            const pres = presences.find(p => {
              const pd = new Date(p.date).toISOString().split("T")[0]
              return pd === dayStr
            })

            return (
              <div key={i} className={`flex flex-col items-center py-4 px-2 ${isToday ? "bg-indigo-50" : ""}`}>
                <p className="text-xs text-slate-400 font-medium">{JOURS[i]}</p>
                <p className={`text-lg font-black mt-0.5 ${isToday ? "text-indigo-700" : "text-slate-800"}`}>
                  {day.getDate()}
                </p>
                <div className="mt-2 space-y-1.5 w-full">
                  {hasAff && aff && (
                    <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: aff.shift.couleur }} />
                  )}
                  {pres && (
                    <div className={`h-1.5 rounded-full w-full ${
                      pres.statut === "PRESENT" ? "bg-green-400" :
                      pres.statut === "RETARD"  ? "bg-amber-400" :
                      pres.statut === "ABSENT"  ? "bg-red-400"   : "bg-slate-200"
                    }`} />
                  )}
                  {!hasAff && !pres && (
                    <div className="h-1.5 rounded-full w-full bg-slate-100" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {/* Legend */}
        <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap gap-4">
          {currentAff && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full" style={{ backgroundColor: currentAff.shift.couleur }} />
              <p className="text-xs text-slate-500">{currentAff.shift.nom}</p>
            </div>
          )}
          {[
            { color: "bg-green-400", label: "Présent" },
            { color: "bg-amber-400", label: "Retard"  },
            { color: "bg-red-400",   label: "Absent"  },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`h-2 w-4 rounded-full ${l.color}`} />
              <p className="text-xs text-slate-500">{l.label}</p>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Toutes les affectations */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Toutes mes affectations</p>
        </div>
        {affectations.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucune affectation enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {[
              { label: "À venir",    items: upcomingAffs,                                         badge: "bg-indigo-100 text-indigo-700" },
              { label: "En cours",   items: currentAff ? [currentAff] : [],                       badge: "bg-emerald-100 text-emerald-700" },
              { label: "Terminées",  items: pastAffs,                                             badge: "bg-slate-100 text-slate-500" },
            ].flatMap(group => group.items.map(a => {
              const status = getStatus(a as Affectation)
              return (
                <div key={a.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: a.shift.couleur + "20" }}>
                      <Clock className="h-4 w-4" style={{ color: a.shift.couleur }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{a.shift.nom}</p>
                      <p className="text-xs font-mono text-slate-500">{a.shift.heureDebut} → {a.shift.heureFin} · {calcHeures(a.shift.heureDebut, a.shift.heureFin)}h/j</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(a.dateDebut)} — {formatDate(a.dateFin)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    status === "current"  ? "bg-emerald-100 text-emerald-700" :
                    status === "upcoming" ? "bg-indigo-100 text-indigo-700"   :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {status === "current" ? "En cours" : status === "upcoming" ? "À venir" : "Terminée"}
                  </span>
                </div>
              )
            }))}
          </div>
        )}
      </div>
    </div>
  )
}
