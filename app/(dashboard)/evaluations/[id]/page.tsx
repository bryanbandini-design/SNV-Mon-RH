"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Star, TrendingUp, Target, Zap, Award,
  Users, Send, Check, Loader2, Download,
} from "lucide-react"
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts"
import { CRITERES_EVALUATION, NOTES_LABELS, formatDate, formatCurrency, MOIS } from "@/lib/utils"
import { toast } from "sonner"

type Evaluation = {
  id: string; typeEvaluation: string; periode: string; dateEval: string; evaluateur: string
  scoreGlobal: number; noteAutoEmploye: number | null; commentaire: string | null
  recommandation: string | null; statut: string; createdAt: string
  employe: { prenom: string; nom: string; matricule: string; poste: string; departement: string | null; salaireBase: number }
  notes:     { critere: string; note: number; commentaire: string | null; poids: number }[]
  objectifs: { id: string; titre: string; description: string | null; resultat: string | null; atteint: string }[]
  actions:   { id: string; titre: string; type: string; description: string | null; echeance: string | null; statut: string }[]
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

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  BROUILLON: { label: "Brouillon", color: "#64748b", bg: "#f8fafc" },
  FINALISE:  { label: "Finalisé",  color: "#d97706", bg: "#fffbeb" },
  PUBLIE:    { label: "Publié",    color: "#059669", bg: "#ecfdf5" },
}

function scoreColor(s: number) {
  if (s >= 4) return { color: "#059669", bg: "#ecfdf5", ring: "#bbf7d0" }
  if (s >= 3) return { color: "#d97706", bg: "#fffbeb", ring: "#fde68a" }
  return { color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" }
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`h-4 w-4 ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
      ))}
    </div>
  )
}

async function exportPDF(ev: Evaluation) {
  const { jsPDF } = await import("jspdf")
  const autoTable  = (await import("jspdf-autotable")).default

  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const purple = [124, 58, 237] as [number, number, number]
  const dark   = [15, 23, 42]   as [number, number, number]
  const grey   = [100, 116, 139] as [number, number, number]
  const st     = scoreColor(ev.scoreGlobal)

  // Header
  doc.setFillColor(...purple)
  doc.rect(0, 0, 210, 45, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20); doc.setFont("helvetica", "bold")
  doc.text("RAPPORT D'ÉVALUATION", 14, 16)
  doc.setFontSize(11); doc.setFont("helvetica", "normal")
  doc.text(`${TYPES_EVAL[ev.typeEvaluation] ?? ev.typeEvaluation} · ${ev.periode}`, 14, 25)
  doc.setFontSize(9)
  doc.text(`${ev.employe.prenom} ${ev.employe.nom} — ${ev.employe.poste} — ${ev.employe.matricule}`, 14, 33)
  doc.text(`Évalué le ${new Date(ev.dateEval).toLocaleDateString("fr-FR")} par ${ev.evaluateur}`, 14, 40)

  // Score global
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, 52, 90, 22, 3, 3, "F")
  doc.setTextColor(...dark)
  doc.setFontSize(9); doc.setFont("helvetica", "normal")
  doc.text("SCORE GLOBAL", 18, 60)
  doc.setFontSize(18); doc.setFont("helvetica", "bold")
  doc.setTextColor(...(st.color.match(/\d+/g)?.map(Number) as [number,number,number] ?? dark))
  doc.text(`${ev.scoreGlobal.toFixed(2)} / 5`, 18, 70)

  if (ev.recommandation && RECOMMANDATIONS[ev.recommandation]) {
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(110, 52, 86, 22, 3, 3, "F")
    doc.setTextColor(...grey)
    doc.setFontSize(9); doc.setFont("helvetica", "normal")
    doc.text("RECOMMANDATION", 114, 60)
    doc.setFontSize(11); doc.setFont("helvetica", "bold")
    doc.setTextColor(...dark)
    doc.text(RECOMMANDATIONS[ev.recommandation].label, 114, 70)
  }

  // Notes par critère
  autoTable(doc, {
    startY: 82,
    head:   [["Critère", "Note", "Appréciation", "Commentaire"]],
    body:   ev.notes.map(n => {
      const critere = CRITERES_EVALUATION.find(c => c.id === n.critere)
      return [critere?.label ?? n.critere, `${n.note}/5`, NOTES_LABELS[n.note] ?? "", n.commentaire ?? ""]
    }),
    headStyles:   { fillColor: purple, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles:   { fontSize: 9, textColor: dark },
    columnStyles: { 1: { halign: "center", cellWidth: 18 }, 2: { cellWidth: 28 } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Objectifs
  if (ev.objectifs.length > 0) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...dark)
    doc.text("Objectifs de la période", 14, y); y += 5
    autoTable(doc, {
      startY: y,
      head:   [["Objectif", "Résultat"]],
      body:   ev.objectifs.map(o => [o.titre, ATTEINT_CFG[o.atteint]?.label ?? o.atteint]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: dark },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Actions
  if (ev.actions.length > 0) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...dark)
    doc.text("Plan de développement", 14, y); y += 5
    autoTable(doc, {
      startY: y,
      head:   [["Action", "Type", "Échéance", "Statut"]],
      body:   ev.actions.map(a => [a.titre, a.type, a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : "—", a.statut]),
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: dark },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Commentaire
  if (ev.commentaire) {
    doc.setFillColor(245, 243, 255)
    doc.roundedRect(14, y, 182, 20, 3, 3, "F")
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...purple)
    doc.text("Commentaire général", 18, y + 6)
    doc.setFont("helvetica", "italic"); doc.setTextColor(...dark)
    const lines = doc.splitTextToSize(ev.commentaire, 174) as string[]
    doc.text(lines.slice(0, 2), 18, y + 13)
    y += 28
  }

  // Footer
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 277, 210, 20, "F")
  doc.setTextColor(...grey); doc.setFontSize(7); doc.setFont("helvetica", "normal")
  doc.text("Document généré automatiquement — Mon RH", 105, 285, { align: "center" })
  doc.text(`Émis le ${new Date().toLocaleDateString("fr-FR")}`, 105, 290, { align: "center" })

  doc.save(`evaluation-${ev.employe.nom}-${ev.periode.replace(/\s/g, "-")}.pdf`)
}

export default function EvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [ev,      setEv]      = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [pdfLoad, setPdfLoad] = useState(false)

  useEffect(() => {
    fetch(`/api/evaluations/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setEv(data) })
      .finally(() => setLoading(false))
  }, [id])

  async function changerStatut(statut: string) {
    setSaving(true)
    const res = await fetch(`/api/evaluations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    })
    setSaving(false)
    if (res.ok && ev) {
      setEv({ ...ev, statut })
      toast.success(statut === "PUBLIE" ? "Évaluation publiée — l'employé est notifié" : "Statut mis à jour")
    }
  }

  async function handleExport() {
    if (!ev) return
    setPdfLoad(true)
    try { await exportPDF(ev); toast.success("PDF téléchargé") }
    catch { toast.error("Erreur export PDF") }
    setPdfLoad(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )

  if (!ev) return (
    <div className="text-center py-20 text-slate-500">Évaluation introuvable</div>
  )

  const st     = scoreColor(ev.scoreGlobal)
  const sCfg   = STATUT_CFG[ev.statut]
  const rCfg   = ev.recommandation ? RECOMMANDATIONS[ev.recommandation] : null

  const radarData = CRITERES_EVALUATION.map(c => {
    const n = ev.notes.find(x => x.critere === c.id)
    return { critere: c.label.split(" ")[0], score: n?.note ?? 0, fullMark: 5 }
  })

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/evaluations")}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ev.employe.prenom} {ev.employe.nom}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {ev.employe.poste}{ev.employe.departement ? ` · ${ev.employe.departement}` : ""} · {ev.employe.matricule}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} disabled={pdfLoad}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {pdfLoad ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exporter PDF
          </button>
          {ev.statut === "BROUILLON" && (
            <button onClick={() => changerStatut("FINALISE")} disabled={saving}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Finaliser
            </button>
          )}
          {ev.statut === "FINALISE" && (
            <button onClick={() => changerStatut("PUBLIE")} disabled={saving}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publier
            </button>
          )}
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Score */}
        <div className="sm:col-span-1 rounded-xl border p-5 flex items-center gap-4" style={{ background: st.bg, borderColor: st.ring }}>
          <div className="h-16 w-16 rounded-full flex flex-col items-center justify-center border-2 flex-shrink-0"
            style={{ background: "white", borderColor: st.ring }}>
            <span className="text-2xl font-black leading-none" style={{ color: st.color }}>{ev.scoreGlobal.toFixed(1)}</span>
            <span className="text-xs" style={{ color: st.color }}>/5</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Score global</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: st.color }}>{NOTES_LABELS[Math.round(ev.scoreGlobal)]}</p>
            <div className="flex items-center gap-0.5 mt-1">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(ev.scoreGlobal) ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Infos */}
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Type</p>
              <p className="font-semibold text-slate-800 text-xs">{TYPES_EVAL[ev.typeEvaluation] ?? ev.typeEvaluation}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Période</p>
              <p className="font-semibold text-slate-800 text-xs">{ev.periode}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Date</p>
              <p className="font-semibold text-slate-800 text-xs">{formatDate(ev.dateEval)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Évaluateur</p>
              <p className="font-semibold text-slate-800 text-xs">{ev.evaluateur}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Statut</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: sCfg.bg, color: sCfg.color }}>{sCfg.label}</span>
            </div>
            {rCfg && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400 mb-0.5">Recommandation</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: rCfg.bg, color: rCfg.color }}>{rCfg.label}</span>
              </div>
            )}
            {ev.noteAutoEmploye !== null && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Auto-éval.</p>
                <p className="font-semibold text-indigo-700 text-xs">{ev.noteAutoEmploye.toFixed(1)}/5</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grille + Radar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Notes critères */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <p className="font-semibold text-slate-900 text-sm">Grille d'évaluation</p>
          </div>
          <div className="p-5 space-y-4">
            {ev.notes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aucune note enregistrée</p>
            ) : ev.notes.map(n => {
              const critere = CRITERES_EVALUATION.find(c => c.id === n.critere)
              const nst     = scoreColor(n.note)
              const pct     = (n.note / 5) * 100
              return (
                <div key={n.critere}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-slate-800">{critere?.label ?? n.critere}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: nst.color }}>{n.note}/5</span>
                      <span className="text-xs text-slate-400">{NOTES_LABELS[n.note]}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: nst.color }} />
                  </div>
                  {n.commentaire && (
                    <p className="text-xs text-slate-400 mt-1 italic">{n.commentaire}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Radar */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-500" />
            <p className="font-semibold text-slate-900 text-sm">Profil de performance</p>
          </div>
          <div className="p-4">
            {radarData.every(r => r.score === 0) ? (
              <div className="flex items-center justify-center h-52 text-sm text-slate-400">Pas de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="critere" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                  <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2.5} dot={{ r: 3, fill: "#8b5cf6" }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Auto-évaluation comparaison */}
          {ev.noteAutoEmploye !== null && (
            <div className="mx-5 mb-5 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 flex items-center gap-3">
              <Users className="h-4 w-4 text-indigo-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-indigo-700">Auto-évaluation employé : {ev.noteAutoEmploye.toFixed(1)}/5</p>
                <p className="text-xs text-indigo-500 mt-0.5">
                  Écart avec RH : {ev.scoreGlobal > ev.noteAutoEmploye ? "+" : ""}{(ev.scoreGlobal - ev.noteAutoEmploye).toFixed(1)} point(s)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Objectifs */}
      {ev.objectifs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-500" />
            <p className="font-semibold text-slate-900 text-sm">Objectifs de la période</p>
          </div>
          <div className="divide-y divide-slate-50">
            {ev.objectifs.map(o => {
              const cfg = ATTEINT_CFG[o.atteint] ?? ATTEINT_CFG.EN_COURS
              return (
                <div key={o.id} className="flex items-start gap-3 px-5 py-4">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{o.titre}</p>
                    {o.description && <p className="text-xs text-slate-500 mt-0.5">{o.description}</p>}
                    {o.resultat && <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 rounded px-2 py-1">{o.resultat}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plan de développement */}
      {ev.actions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-500" />
            <p className="font-semibold text-slate-900 text-sm">Plan de développement</p>
          </div>
          <div className="divide-y divide-slate-50">
            {ev.actions.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold flex-shrink-0 mt-0.5">{a.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{a.titre}</p>
                  {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                  <div className="flex gap-3 mt-1">
                    {a.echeance && <p className="text-xs text-slate-400">Échéance : {formatDate(a.echeance)}</p>}
                    <p className="text-xs text-slate-400">{a.statut}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commentaire général */}
      {ev.commentaire && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-5">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Commentaire général</p>
          <p className="text-slate-800 leading-relaxed italic">&ldquo;{ev.commentaire}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
