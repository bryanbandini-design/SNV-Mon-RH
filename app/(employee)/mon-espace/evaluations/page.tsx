import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { Star, TrendingUp } from "lucide-react"

function ScoreCircle({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 4 ? "#10b981" : score >= 3 ? "#f59e0b" : "#ef4444"
  const bg    = score >= 4 ? "#ecfdf5"  : score >= 3 ? "#fffbeb"  : "#fef2f2"
  const dim   = size === "lg" ? "h-16 w-16 text-2xl" : size === "md" ? "h-10 w-10 text-base" : "h-8 w-8 text-xs"
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-black flex-shrink-0`}
      style={{ background: bg, color }}>
      {score.toFixed(1)}
    </div>
  )
}

function ScoreBar({ note, max = 5 }: { note: number; max?: number }) {
  const pct  = Math.round((note / max) * 100)
  const color = note >= 4 ? "#10b981" : note >= 3 ? "#f59e0b" : "#ef4444"
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default async function MesEvaluationsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId as string | null
  if (!employeId) redirect("/login")

  const evaluations = await prisma.evaluation.findMany({
    where:   { employeId, statut: "PUBLIE" },
    include: { notes: { orderBy: { critere: "asc" } } },
    orderBy: { dateEval: "desc" },
  })

  const derniere  = evaluations[0]
  const moyenne   = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.scoreGlobal, 0) / evaluations.length
    : null
  const meilleure = evaluations.length > 0
    ? Math.max(...evaluations.map(e => e.scoreGlobal))
    : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes évaluations</h1>
        <p className="text-sm text-slate-500 mt-1">Historique de vos évaluations de performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-2xl font-black text-slate-900">{evaluations.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-2xl font-black text-slate-900">{moyenne ? moyenne.toFixed(2) : "—"}</p>
          <p className="text-xs text-slate-400 mt-0.5">Moyenne /5</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-2xl font-black text-emerald-700">{meilleure ? meilleure.toFixed(1) : "—"}</p>
          <p className="text-xs text-slate-400 mt-0.5">Meilleure</p>
        </div>
      </div>

      {evaluations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white text-center py-16">
          <Star className="h-12 w-12 mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-500">Aucune évaluation disponible</p>
          <p className="text-xs text-slate-400 mt-1">Vos évaluations apparaîtront ici une fois réalisées</p>
        </div>
      ) : (
        <>
          {/* Dernière évaluation — détail */}
          {derniere && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Dernière évaluation</p>
                  <p className="text-xs text-slate-400 mt-0.5">{derniere.periode} · {formatDate(derniere.dateEval)} · par {derniere.evaluateur}</p>
                </div>
                <ScoreCircle score={derniere.scoreGlobal} size="lg" />
              </div>

              {/* Notes par critère */}
              {derniere.notes.length > 0 && (
                <div className="p-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Notes par critère</p>
                  <div className="space-y-4">
                    {derniere.notes.map(n => (
                      <div key={n.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm text-slate-700 font-medium">{n.critere}</p>
                          <div className="flex items-center gap-2">
                            <ScoreCircle score={n.note} size="sm" />
                            <p className="text-xs text-slate-400">/5</p>
                          </div>
                        </div>
                        <ScoreBar note={n.note} />
                        {n.commentaire && (
                          <p className="text-xs text-slate-400 mt-1 italic">{n.commentaire}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {derniere.commentaire && (
                <div className="px-6 pb-6">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Commentaire général</p>
                    <p className="text-sm text-slate-700 italic">&ldquo;{derniere.commentaire}&rdquo;</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historique */}
          {evaluations.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                <p className="font-semibold text-slate-900 text-sm">Historique</p>
              </div>
              <div className="divide-y divide-slate-50">
                {evaluations.map((ev, i) => (
                  <div key={ev.id} className={`flex items-center justify-between px-6 py-4 ${i === 0 ? "bg-slate-50/50" : ""}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{ev.periode}</p>
                        {i === 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Dernière</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(ev.dateEval)} · {ev.evaluateur}</p>
                      {ev.notes.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {ev.notes.slice(0, 3).map(n => (
                            <span key={n.id} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {n.critere}: {n.note}/5
                            </span>
                          ))}
                          {ev.notes.length > 3 && (
                            <span className="text-xs text-slate-400">+{ev.notes.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ScoreCircle score={ev.scoreGlobal} size="md" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
