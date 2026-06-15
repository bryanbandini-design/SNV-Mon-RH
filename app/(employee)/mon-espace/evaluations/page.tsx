import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { Star, TrendingUp, Target, Zap, Award } from "lucide-react"

const CRITERES_LABEL: Record<string, string> = {
  qualite_travail: "Qualité du travail", productivite: "Productivité",
  ponctualite: "Ponctualité", communication: "Communication",
  travail_equipe: "Travail d'équipe", initiative: "Initiative",
  respect_procedures: "Respect procédures", developpement: "Développement",
}

const TYPES_EVAL: Record<string, string> = {
  ANNUELLE: "Annuelle", SEMESTRIELLE: "Semestrielle", TRIMESTRIELLE: "Trimestrielle",
  PERIODE_ESSAI: "Période d'essai", PONCTUELLE: "Ponctuelle",
}

const RECOMMANDATIONS: Record<string, { label: string; color: string; bg: string }> = {
  PROMOTION:    { label: "Promotion",           color: "#7c3aed", bg: "#f5f3ff" },
  AUGMENTATION: { label: "Augmentation",        color: "#059669", bg: "#ecfdf5" },
  FORMATION:    { label: "Formation requise",   color: "#2563eb", bg: "#eff6ff" },
  MAINTIEN:     { label: "Maintien de poste",   color: "#64748b", bg: "#f8fafc" },
  VIGILANCE:    { label: "Mise sous vigilance", color: "#dc2626", bg: "#fef2f2" },
}

const ATTEINT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ATTEINT:     { label: "Atteint",     color: "#059669", bg: "#ecfdf5" },
  PARTIEL:     { label: "Partiel",     color: "#d97706", bg: "#fffbeb" },
  NON_ATTEINT: { label: "Non atteint", color: "#dc2626", bg: "#fef2f2" },
  EN_COURS:    { label: "En cours",    color: "#2563eb", bg: "#eff6ff" },
}

function scoreColor(s: number) {
  if (s >= 4) return { color: "#059669", bg: "#ecfdf5", ring: "#bbf7d0" }
  if (s >= 3) return { color: "#d97706", bg: "#fffbeb", ring: "#fde68a" }
  return { color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" }
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`h-3.5 w-3.5 ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
      ))}
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
    include: {
      notes:     { orderBy: { critere: "asc" } },
      objectifs: { orderBy: { createdAt: "asc" } },
      actions:   { orderBy: { createdAt: "asc" } },
    },
    orderBy: { dateEval: "desc" },
  })

  const derniere  = evaluations[0]
  const moyenne   = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + e.scoreGlobal, 0) / evaluations.length : null
  const meilleure = evaluations.length > 0
    ? Math.max(...evaluations.map(e => e.scoreGlobal)) : null
  const progression = evaluations.length >= 2
    ? evaluations[0].scoreGlobal - evaluations[evaluations.length - 1].scoreGlobal : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes évaluations</h1>
        <p className="text-sm text-slate-500 mt-1">Suivi de votre performance et plan de développement</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Évaluations",  value: `${evaluations.length}`,                      color: "text-slate-900" },
          { label: "Score moyen",  value: moyenne   ? `${moyenne.toFixed(2)}/5`   : "—", color: "text-purple-700" },
          { label: "Meilleur",     value: meilleure ? `${meilleure.toFixed(1)}/5`  : "—", color: "text-emerald-700" },
          {
            label: "Progression",
            value: progression !== null ? `${progression >= 0 ? "+" : ""}${progression.toFixed(1)}` : "—",
            color: progression !== null ? (progression >= 0 ? "text-emerald-700" : "text-red-600") : "text-slate-400",
          },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {evaluations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white text-center py-16">
          <Star className="h-12 w-12 mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-500">Aucune évaluation disponible</p>
          <p className="text-xs text-slate-400 mt-1">Vos évaluations apparaîtront ici une fois publiées</p>
        </div>
      ) : (
        <>
          {/* Courbe d'évolution CSS */}
          {evaluations.length >= 2 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" /> Évolution de vos scores
              </p>
              <div className="flex items-end gap-2 h-24">
                {[...evaluations].reverse().map((ev, i) => {
                  const st  = scoreColor(ev.scoreGlobal)
                  const pct = (ev.scoreGlobal / 5) * 100
                  return (
                    <div key={ev.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: st.color }}>{ev.scoreGlobal.toFixed(1)}</span>
                      <div className="w-full rounded-t-lg transition-all" style={{ height: `${pct}%`, backgroundColor: st.color, opacity: i === evaluations.length - 1 ? 1 : 0.6 }} />
                      <span className="text-[10px] text-slate-400 text-center truncate w-full">{ev.periode}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dernière évaluation détail */}
          {derniere && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">Dernière évaluation</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{derniere.periode}</span>
                    <span className="text-xs text-slate-400">{TYPES_EVAL[derniere.typeEvaluation] ?? derniere.typeEvaluation}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(derniere.dateEval)} · par {derniere.evaluateur}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black" style={{ color: scoreColor(derniere.scoreGlobal).color }}>{derniere.scoreGlobal.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">/5</p>
                </div>
              </div>

              {/* Recommandation */}
              {derniere.recommandation && RECOMMANDATIONS[derniere.recommandation] && (
                <div className="mx-5 mt-4 rounded-lg px-4 py-3 flex items-center gap-2"
                  style={{ background: RECOMMANDATIONS[derniere.recommandation].bg }}>
                  <Award className="h-4 w-4 flex-shrink-0" style={{ color: RECOMMANDATIONS[derniere.recommandation].color }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: RECOMMANDATIONS[derniere.recommandation].color }}>
                      Recommandation RH : {RECOMMANDATIONS[derniere.recommandation].label}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes critères */}
              {derniere.notes.length > 0 && (
                <div className="p-5 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Détail par critère</p>
                  <div className="space-y-3">
                    {derniere.notes.map(n => {
                      const st  = scoreColor(n.note)
                      const pct = (n.note / 5) * 100
                      return (
                        <div key={n.critere}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-slate-700 font-medium">{CRITERES_LABEL[n.critere] ?? n.critere}</p>
                            <div className="flex items-center gap-2">
                              <StarRow value={n.note} />
                              <span className="text-xs font-bold w-6 text-right" style={{ color: st.color }}>{n.note}/5</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: st.color }} />
                          </div>
                          {n.commentaire && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">{n.commentaire}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Commentaire */}
              {derniere.commentaire && (
                <div className="mx-5 mb-5 rounded-lg bg-purple-50 border border-purple-100 p-4">
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Commentaire de l'évaluateur</p>
                  <p className="text-sm text-slate-700 italic">&ldquo;{derniere.commentaire}&rdquo;</p>
                </div>
              )}
            </div>
          )}

          {/* Objectifs */}
          {derniere?.objectifs && derniere.objectifs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <p className="font-semibold text-slate-900 text-sm">Objectifs de la période</p>
              </div>
              <div className="divide-y divide-slate-50">
                {derniere.objectifs.map(o => {
                  const cfg = ATTEINT_CFG[o.atteint] ?? ATTEINT_CFG.EN_COURS
                  return (
                    <div key={o.id} className="flex items-start gap-3 px-5 py-4">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{o.titre}</p>
                        {o.resultat && <p className="text-xs text-slate-500 mt-0.5 italic">{o.resultat}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Plan de développement */}
          {derniere?.actions && derniere.actions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                <p className="font-semibold text-slate-900 text-sm">Mon plan de développement</p>
              </div>
              <div className="divide-y divide-slate-50">
                {derniere.actions.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold flex-shrink-0 mt-0.5">{a.type}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{a.titre}</p>
                      {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                      {a.echeance && <p className="text-xs text-slate-400 mt-0.5">Échéance : {formatDate(a.echeance)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique */}
          {evaluations.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                <p className="font-semibold text-slate-900 text-sm">Historique complet</p>
              </div>
              <div className="divide-y divide-slate-50">
                {evaluations.map((ev, i) => {
                  const st   = scoreColor(ev.scoreGlobal)
                  const rCfg = ev.recommandation ? RECOMMANDATIONS[ev.recommandation] : null
                  return (
                    <div key={ev.id} className={`flex items-center justify-between px-5 py-4 ${i === 0 ? "bg-slate-50/50" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900">{ev.periode}</p>
                          {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Dernière</span>}
                          {rCfg && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rCfg.bg, color: rCfg.color }}>{rCfg.label}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(ev.dateEval)} · {ev.evaluateur}</p>
                        {ev.notes.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {ev.notes.slice(0, 3).map(n => (
                              <span key={n.critere} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {CRITERES_LABEL[n.critere]?.split(" ")[0] ?? n.critere}: {n.note}/5
                              </span>
                            ))}
                            {ev.notes.length > 3 && <span className="text-xs text-slate-400">+{ev.notes.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center flex-shrink-0 ml-4">
                        <span className="text-xl font-black" style={{ color: st.color }}>{ev.scoreGlobal.toFixed(1)}</span>
                        <StarRow value={Math.round(ev.scoreGlobal)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
