"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Star, TrendingUp, ChevronDown, ChevronUp, Loader2,
  Trash2, Eye, Send, FileText, Target, Zap, Award,
  Users, BarChart2, RefreshCw, Pencil, Check, X,
} from "lucide-react"
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"
import { CRITERES_EVALUATION, NOTES_LABELS, formatDate } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type Employe = { id: string; prenom: string; nom: string; matricule: string; poste: string; departement: string | null }
type NoteEval  = { critere: string; note: number; commentaire: string; poids: number }
type Objectif  = { titre: string; description: string; resultat: string; atteint: string }
type Action    = { titre: string; type: string; description: string; echeance: string; statut: string }

type Evaluation = {
  id: string; typeEvaluation: string; periode: string; dateEval: string; evaluateur: string
  scoreGlobal: number; noteAutoEmploye: number | null; commentaire: string | null
  recommandation: string | null; statut: string; createdAt: string
  employe: { prenom: string; nom: string; matricule: string; poste: string; departement: string | null }
  notes:     { critere: string; note: number; commentaire: string | null; poids: number }[]
  objectifs: { id: string; titre: string; description: string | null; resultat: string | null; atteint: string }[]
  actions:   { id: string; titre: string; type: string; description: string | null; echeance: string | null; statut: string }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPES_EVAL = [
  { value: "ANNUELLE",      label: "Annuelle" },
  { value: "SEMESTRIELLE",  label: "Semestrielle" },
  { value: "TRIMESTRIELLE", label: "Trimestrielle" },
  { value: "PERIODE_ESSAI", label: "Période d'essai" },
  { value: "PONCTUELLE",    label: "Ponctuelle" },
]

const RECOMMANDATIONS = [
  { value: "PROMOTION",   label: "Promotion",          color: "#7c3aed", bg: "#f5f3ff" },
  { value: "AUGMENTATION",label: "Augmentation",       color: "#059669", bg: "#ecfdf5" },
  { value: "FORMATION",   label: "Formation requise",  color: "#2563eb", bg: "#eff6ff" },
  { value: "MAINTIEN",    label: "Maintien de poste",  color: "#64748b", bg: "#f8fafc" },
  { value: "VIGILANCE",   label: "Mise sous vigilance",color: "#dc2626", bg: "#fef2f2" },
]

const ATTEINT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ATTEINT:      { label: "Atteint",      color: "#059669", bg: "#ecfdf5" },
  PARTIEL:      { label: "Partiel",      color: "#d97706", bg: "#fffbeb" },
  NON_ATTEINT:  { label: "Non atteint",  color: "#dc2626", bg: "#fef2f2" },
  EN_COURS:     { label: "En cours",     color: "#2563eb", bg: "#eff6ff" },
}

const ACTION_TYPES = ["FORMATION", "COACHING", "PROJET", "RESPONSABILITE", "AUTRE"]
const ACTION_STATUTS = ["PLANIFIE", "EN_COURS", "REALISE", "ANNULE"]

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  BROUILLON: { label: "Brouillon",  color: "#64748b", bg: "#f8fafc" },
  FINALISE:  { label: "Finalisé",   color: "#d97706", bg: "#fffbeb" },
  PUBLIE:    { label: "Publié",     color: "#059669", bg: "#ecfdf5" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 4) return { color: "#059669", bg: "#ecfdf5", ring: "#bbf7d0" }
  if (s >= 3) return { color: "#d97706", bg: "#fffbeb", ring: "#fde68a" }
  return { color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" }
}

function StarDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`${cls} ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
      ))}
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)} className="focus:outline-none">
          <Star className={`h-5 w-5 transition-colors ${s <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-xs text-slate-500">{NOTES_LABELS[value]}</span>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [employes,    setEmployes]    = useState<Employe[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [tab,         setTab]         = useState<"dashboard" | "liste" | "nouveau">("dashboard")
  const [expanded,    setExpanded]    = useState<string | null>(null)

  // Filters
  const [filtreEmp,    setFiltreEmp]    = useState("tous")
  const [filtreType,   setFiltreType]   = useState("tous")
  const [filtreStatut, setFiltreStatut] = useState("tous")
  const [filtreSearch, setFiltreSearch] = useState("")

  // Form
  const initNotes    = () => CRITERES_EVALUATION.map(c => ({ critere: c.id, note: 0, commentaire: "", poids: 1 }))
  const initObjectif = (): Objectif => ({ titre: "", description: "", resultat: "", atteint: "EN_COURS" })
  const initAction   = (): Action   => ({ titre: "", type: "FORMATION", description: "", echeance: "", statut: "PLANIFIE" })

  const [form, setForm] = useState({
    employeId: "", typeEvaluation: "ANNUELLE", periode: "",
    dateEval: new Date().toISOString().split("T")[0],
    evaluateur: "", commentaire: "", recommandation: "",
  })
  const [notes,     setNotes]     = useState<NoteEval[]>(initNotes())
  const [objectifs, setObjectifs] = useState<Objectif[]>([])
  const [actions,   setActions]   = useState<Action[]>([])

  // ── Load ──────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    const [evs, emps] = await Promise.all([
      fetch("/api/evaluations").then(r => r.ok ? r.json() : []),
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
    ])
    if (Array.isArray(evs))  setEvaluations(evs)
    if (Array.isArray(emps)) setEmployes(emps)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Filtered list ─────────────────────────────────────────────────────────

  const liste = useMemo(() => evaluations.filter(ev => {
    if (filtreEmp    !== "tous" && ev.employe.prenom + " " + ev.employe.nom !== filtreEmp &&
        !ev.employe.matricule.includes(filtreEmp)) {
      const emp = employes.find(e => e.id === filtreEmp)
      if (emp && (ev.employe.prenom !== emp.prenom || ev.employe.nom !== emp.nom)) return false
    }
    if (filtreType   !== "tous" && ev.typeEvaluation !== filtreType)   return false
    if (filtreStatut !== "tous" && ev.statut         !== filtreStatut) return false
    if (filtreSearch) {
      const q = filtreSearch.toLowerCase()
      if (!`${ev.employe.prenom} ${ev.employe.nom} ${ev.periode} ${ev.evaluateur}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [evaluations, filtreEmp, filtreType, filtreStatut, filtreSearch, employes])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const published  = evaluations.filter(e => e.statut === "PUBLIE")
    const brouillons = evaluations.filter(e => e.statut === "BROUILLON").length
    const moyenne    = published.length > 0 ? published.reduce((a, e) => a + e.scoreGlobal, 0) / published.length : null
    const topPerf    = published.length > 0 ? [...published].sort((a, b) => b.scoreGlobal - a.scoreGlobal).slice(0, 3) : []

    // Évolution par trimestre
    const byPeriod: Record<string, number[]> = {}
    published.forEach(ev => {
      const key = ev.periode
      if (!byPeriod[key]) byPeriod[key] = []
      byPeriod[key].push(ev.scoreGlobal)
    })
    const evolution = Object.entries(byPeriod)
      .map(([periode, scores]) => ({ periode, moyenne: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2), count: scores.length }))
      .slice(-8)

    // Scores par critère (moyenne)
    const byCritere: Record<string, number[]> = {}
    published.forEach(ev => ev.notes.forEach(n => {
      if (!byCritere[n.critere]) byCritere[n.critere] = []
      byCritere[n.critere].push(n.note)
    }))
    const radar = CRITERES_EVALUATION.map(c => ({
      critere: c.label.split(" ")[0],
      score:   byCritere[c.id] ? +(byCritere[c.id].reduce((a, b) => a + b, 0) / byCritere[c.id].length).toFixed(1) : 0,
      fullMark: 5,
    }))

    return { published: published.length, brouillons, moyenne, topPerf, evolution, radar }
  }, [evaluations])

  // ── Form helpers ──────────────────────────────────────────────────────────

  function updateNote(critere: string, note: number) {
    setNotes(prev => prev.map(n => n.critere === critere ? { ...n, note } : n))
  }
  function updateNoteComment(critere: string, commentaire: string) {
    setNotes(prev => prev.map(n => n.critere === critere ? { ...n, commentaire } : n))
  }

  const notedCount   = notes.filter(n => n.note > 0).length
  const scorePreview = notedCount > 0
    ? notes.filter(n => n.note > 0).reduce((a, n) => a + n.note, 0) / notedCount
    : null

  function resetForm() {
    setForm({ employeId: "", typeEvaluation: "ANNUELLE", periode: "", dateEval: new Date().toISOString().split("T")[0], evaluateur: "", commentaire: "", recommandation: "" })
    setNotes(initNotes())
    setObjectifs([])
    setActions([])
  }

  async function handleSubmit(e: React.FormEvent, statut: "BROUILLON" | "FINALISE" | "PUBLIE") {
    e.preventDefault()
    if (!form.employeId || !form.periode || notedCount === 0) {
      toast.error("Veuillez remplir tous les champs obligatoires et noter au moins un critère")
      return
    }
    setSaving(true)
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        notes: notes.filter(n => n.note > 0),
        objectifs: objectifs.filter(o => o.titre.trim()),
        actions:   actions.filter(a => a.titre.trim()),
        statut,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const newEval = await res.json()
      setEvaluations(prev => [newEval, ...prev])
      resetForm()
      setTab("liste")
      toast.success(statut === "PUBLIE" ? "Évaluation publiée" : statut === "FINALISE" ? "Évaluation finalisée" : "Brouillon sauvegardé")
    } else {
      toast.error("Erreur lors de l'enregistrement")
    }
  }

  async function changerStatut(id: string, statut: string) {
    const res = await fetch(`/api/evaluations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    })
    if (res.ok) {
      setEvaluations(prev => prev.map(ev => ev.id === id ? { ...ev, statut } : ev))
      toast.success(statut === "PUBLIE" ? "Évaluation publiée — l'employé est notifié" : "Statut mis à jour")
    }
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer cette évaluation ?")) return
    const res = await fetch(`/api/evaluations/${id}`, { method: "DELETE" })
    if (res.ok) {
      setEvaluations(prev => prev.filter(ev => ev.id !== id))
      toast.success("Évaluation supprimée")
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Évaluations de performance</h1>
          <p className="text-sm text-slate-500 mt-1">
            {evaluations.length} évaluation(s) · {stats.published} publiée(s)
            {stats.moyenne && <span> · Moyenne globale <strong style={{ color: scoreColor(stats.moyenne).color }}>{stats.moyenne.toFixed(2)}/5</strong></span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setTab("nouveau")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle évaluation</span>
            <span className="sm:hidden">Nouvelle</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-fit">
        {[
          { id: "dashboard", label: "Tableau de bord", icon: BarChart2 },
          { id: "liste",     label: "Évaluations",     icon: FileText  },
          { id: "nouveau",   label: "Nouvelle",         icon: Plus      },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
              {t.id === "liste" && evaluations.length > 0 && (
                <span className="ml-1 text-xs bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5">{evaluations.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB: DASHBOARD ──────────────────────────────────────────────── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : evaluations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-20">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-200" />
              <p className="font-medium text-slate-500">Aucune évaluation enregistrée</p>
              <p className="text-sm text-slate-400 mt-1">Commencez par créer une première évaluation</p>
              <button onClick={() => setTab("nouveau")} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#8b5cf6" }}>
                Créer une évaluation
              </button>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: "Évaluations publiées",  value: stats.published,  icon: Check,   color: "#059669", bg: "#ecfdf5" },
                  { label: "Brouillons en cours",    value: stats.brouillons, icon: Pencil,  color: "#d97706", bg: "#fffbeb" },
                  { label: "Score moyen",            value: stats.moyenne ? `${stats.moyenne.toFixed(2)}/5` : "—", icon: Star, color: "#8b5cf6", bg: "#f5f3ff" },
                  { label: "Employés évalués",       value: new Set(evaluations.map(e => e.employe.matricule)).size, icon: Users, color: "#2563eb", bg: "#eff6ff" },
                ].map(k => {
                  const Icon = k.icon
                  return (
                    <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-slate-500">{k.label}</p>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                          <Icon className="h-4 w-4" style={{ color: k.color }} />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-slate-900">{k.value}</p>
                    </div>
                  )
                })}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

                {/* Évolution */}
                <div className="col-span-1 lg:col-span-3 rounded-xl border border-slate-200 bg-white p-5">
                  <p className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" /> Évolution des scores par période
                  </p>
                  {stats.evolution.length < 2 ? (
                    <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                      Pas encore assez de données pour afficher la courbe
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={stats.evolution}>
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="periode" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}/5`, "Moyenne"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Area type="monotone" dataKey="moyenne" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#scoreGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Radar critères */}
                <div className="col-span-1 lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
                  <p className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" /> Scores par critère
                  </p>
                  {stats.radar.every(r => r.score === 0) ? (
                    <div className="flex items-center justify-center h-40 text-sm text-slate-400">Pas encore de données</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={stats.radar}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="critere" tick={{ fontSize: 9, fill: "#64748b" }} />
                        <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                        <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Top performers + Recommandations */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                {/* Top performers */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    <p className="font-semibold text-slate-900 text-sm">Top performers</p>
                  </div>
                  {stats.topPerf.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">Aucune évaluation publiée</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {stats.topPerf.map((ev, i) => {
                        const st = scoreColor(ev.scoreGlobal)
                        return (
                          <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-orange-50 text-orange-600"}`}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{ev.employe.prenom} {ev.employe.nom}</p>
                              <p className="text-xs text-slate-400 truncate">{ev.employe.poste} · {ev.periode}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StarDisplay value={Math.round(ev.scoreGlobal)} />
                              <span className="text-sm font-black" style={{ color: st.color }}>{ev.scoreGlobal.toFixed(1)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Recommandations distribution */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-indigo-500" />
                    <p className="font-semibold text-slate-900 text-sm">Recommandations RH</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {RECOMMANDATIONS.map(r => {
                      const count = evaluations.filter(ev => ev.recommandation === r.value && ev.statut !== "BROUILLON").length
                      const total = evaluations.filter(ev => ev.recommandation && ev.statut !== "BROUILLON").length
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                      return (
                        <div key={r.value}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-700">{r.label}</span>
                            <span className="text-xs text-slate-400">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: r.color }} />
                          </div>
                        </div>
                      )
                    })}
                    {evaluations.filter(ev => ev.statut !== "BROUILLON").every(ev => !ev.recommandation) && (
                      <p className="text-xs text-slate-400 text-center py-2">Aucune recommandation enregistrée</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: LISTE ──────────────────────────────────────────────────── */}
      {tab === "liste" && (
        <div className="space-y-4">

          {/* Filtres */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Input placeholder="Rechercher…" value={filtreSearch} onChange={e => setFiltreSearch(e.target.value)} className="pl-8 text-sm" />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <Select value={filtreEmp} onValueChange={setFiltreEmp}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Employé" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les employés</SelectItem>
                  {employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtreType} onValueChange={setFiltreType}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les types</SelectItem>
                  {TYPES_EVAL.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {Object.entries(STATUT_CFG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : liste.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-16">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 text-sm">Aucune évaluation trouvée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liste.map(ev => {
                const st    = scoreColor(ev.scoreGlobal)
                const sCfg  = STATUT_CFG[ev.statut] ?? STATUT_CFG.BROUILLON
                const rCfg  = RECOMMANDATIONS.find(r => r.value === ev.recommandation)
                const isExp = expanded === ev.id
                return (
                  <div key={ev.id} className="rounded-xl border bg-white overflow-hidden transition-shadow hover:shadow-sm" style={{ borderColor: st.ring }}>
                    <div className="h-1" style={{ background: st.color }} />
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        {/* Score */}
                        <div className="h-14 w-14 rounded-full flex flex-col items-center justify-center flex-shrink-0 border-2"
                          style={{ background: st.bg, borderColor: st.ring }}>
                          <span className="text-lg font-black leading-none" style={{ color: st.color }}>{ev.scoreGlobal.toFixed(1)}</span>
                          <span className="text-[10px]" style={{ color: st.color }}>/5</span>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{ev.employe.prenom} {ev.employe.nom}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">{ev.employe.poste}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">{ev.periode}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sCfg.bg, color: sCfg.color }}>{sCfg.label}</span>
                            {rCfg && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rCfg.bg, color: rCfg.color }}>{rCfg.label}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <StarDisplay value={Math.round(ev.scoreGlobal)} />
                            <span className="text-xs text-slate-400">{TYPES_EVAL.find(t => t.value === ev.typeEvaluation)?.label} · {formatDate(ev.dateEval)} · {ev.evaluateur}</span>
                          </div>
                          {(ev.objectifs.length > 0 || ev.actions.length > 0) && (
                            <div className="flex gap-2 mt-2">
                              {ev.objectifs.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{ev.objectifs.length} objectif(s)</span>}
                              {ev.actions.length   > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">{ev.actions.length} action(s)</span>}
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => router.push(`/evaluations/${ev.id}`)}
                            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {ev.statut === "BROUILLON" && (
                            <button onClick={() => changerStatut(ev.id, "FINALISE")}
                              className="h-8 w-8 rounded-lg border border-amber-200 flex items-center justify-center text-amber-500 hover:bg-amber-50 transition-colors" title="Finaliser">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {ev.statut === "FINALISE" && (
                            <button onClick={() => changerStatut(ev.id, "PUBLIE")}
                              className="h-8 w-8 rounded-lg border border-emerald-200 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors" title="Publier">
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => supprimer(ev.id)}
                            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setExpanded(isExp ? null : ev.id)}
                            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
                            {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded */}
                      {isExp && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                          {/* Notes critères */}
                          {ev.notes.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes par critère</p>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                {ev.notes.map(n => {
                                  const critere = CRITERES_EVALUATION.find(c => c.id === n.critere)
                                  const nst = scoreColor(n.note)
                                  return (
                                    <div key={n.critere} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                      <span className="text-xs font-medium text-slate-700 truncate mr-2">{critere?.label ?? n.critere}</span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <StarDisplay value={n.note} size="xs" />
                                        <span className="text-xs font-bold" style={{ color: nst.color }}>{n.note}/5</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Auto-évaluation */}
                          {ev.noteAutoEmploye !== null && (
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 flex items-center gap-3">
                              <Users className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-indigo-700">Auto-évaluation de l'employé</p>
                                <p className="text-sm font-bold text-indigo-900">{ev.noteAutoEmploye.toFixed(1)}/5</p>
                              </div>
                              <div className="ml-auto text-xs text-indigo-600">
                                Écart: {(ev.scoreGlobal - ev.noteAutoEmploye).toFixed(1)}
                              </div>
                            </div>
                          )}

                          {/* Objectifs */}
                          {ev.objectifs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Objectifs</p>
                              <div className="space-y-1.5">
                                {ev.objectifs.map(o => {
                                  const cfg = ATTEINT_CFG[o.atteint] ?? ATTEINT_CFG.EN_COURS
                                  return (
                                    <div key={o.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-800">{o.titre}</p>
                                        {o.resultat && <p className="text-xs text-slate-500 mt-0.5 italic">{o.resultat}</p>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {ev.actions.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plan de développement</p>
                              <div className="space-y-1.5">
                                {ev.actions.map(a => (
                                  <div key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium flex-shrink-0 mt-0.5">{a.type}</span>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-800">{a.titre}</p>
                                      {a.echeance && <p className="text-xs text-slate-400 mt-0.5">Échéance : {formatDate(a.echeance)}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Commentaire */}
                          {ev.commentaire && (
                            <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-3">
                              <p className="text-xs text-purple-500 font-semibold mb-1">Commentaire général</p>
                              <p className="text-sm text-slate-700 italic">&ldquo;{ev.commentaire}&rdquo;</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: NOUVEAU ────────────────────────────────────────────────── */}
      {tab === "nouveau" && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/20 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" /> Nouvelle évaluation de performance
            </h2>
            <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Réinitialiser
            </button>
          </div>

          <form onSubmit={e => handleSubmit(e, "PUBLIE")} className="space-y-6">

            {/* Infos générales */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Informations générales</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Employé *</Label>
                  <Select value={form.employeId} onValueChange={v => setForm(p => ({ ...p, employeId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Type d'évaluation *</Label>
                  <Select value={form.typeEvaluation} onValueChange={v => setForm(p => ({ ...p, typeEvaluation: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES_EVAL.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Période évaluée *</Label>
                  <Input placeholder="ex: T2 2025, Annuel 2025" value={form.periode} onChange={e => setForm(p => ({ ...p, periode: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Date de l'évaluation *</Label>
                  <Input type="date" value={form.dateEval} onChange={e => setForm(p => ({ ...p, dateEval: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Évaluateur *</Label>
                  <Input placeholder="Votre nom" value={form.evaluateur} onChange={e => setForm(p => ({ ...p, evaluateur: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Recommandation RH</Label>
                  <Select value={form.recommandation} onValueChange={v => setForm(p => ({ ...p, recommandation: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir (optionnel)" /></SelectTrigger>
                    <SelectContent>{RECOMMANDATIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Score preview */}
            {scorePreview !== null && (
              <div className="flex items-center gap-4 rounded-xl px-5 py-4 border" style={{ background: scoreColor(scorePreview).bg, borderColor: scoreColor(scorePreview).ring }}>
                <div className="h-12 w-12 rounded-full flex flex-col items-center justify-center border-2 font-black"
                  style={{ background: "white", color: scoreColor(scorePreview).color, borderColor: scoreColor(scorePreview).ring }}>
                  <span className="text-lg leading-none">{scorePreview.toFixed(1)}</span>
                  <span className="text-[10px] font-normal">/5</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Score préliminaire ({notedCount}/{CRITERES_EVALUATION.length} critères notés)</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: scoreColor(scorePreview).color }}>{NOTES_LABELS[Math.round(scorePreview)]}</p>
                </div>
                <div className="ml-auto">
                  <StarDisplay value={Math.round(scorePreview)} />
                </div>
              </div>
            )}

            {/* Critères */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grille d'évaluation</p>
              <div className="space-y-2">
                {CRITERES_EVALUATION.map(c => {
                  const n = notes.find(x => x.critere === c.id)!
                  return (
                    <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
                        </div>
                        <StarRating value={n.note} onChange={v => updateNote(c.id, v)} />
                      </div>
                      {n.note > 0 && (
                        <Input placeholder="Commentaire sur ce critère (optionnel)" value={n.commentaire}
                          onChange={e => updateNoteComment(c.id, e.target.value)} className="text-xs h-8 bg-white" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Objectifs */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Objectifs de la période</p>
                <button type="button" onClick={() => setObjectifs(p => [...p, initObjectif()])}
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium">
                  <Plus className="h-3.5 w-3.5" /> Ajouter un objectif
                </button>
              </div>
              {objectifs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun objectif défini pour cette période. Cliquez sur &ldquo;Ajouter&rdquo;.</p>
              ) : (
                <div className="space-y-3">
                  {objectifs.map((o, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-600">Objectif {i + 1}</p>
                        <button type="button" onClick={() => setObjectifs(p => p.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-600">Titre *</Label>
                          <Input value={o.titre} onChange={e => setObjectifs(p => p.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))}
                            placeholder="Ex: Augmenter le CA de 10%" className="text-xs h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-600">Résultat obtenu</Label>
                          <Select value={o.atteint} onValueChange={v => setObjectifs(p => p.map((x, j) => j === i ? { ...x, atteint: v } : x))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(ATTEINT_CFG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-slate-600">Commentaire sur le résultat</Label>
                          <Input value={o.resultat} onChange={e => setObjectifs(p => p.map((x, j) => j === i ? { ...x, resultat: e.target.value } : x))}
                            placeholder="Bilan succinct…" className="text-xs h-8" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Plan de développement */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan de développement</p>
                <button type="button" onClick={() => setActions(p => [...p, initAction()])}
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une action
                </button>
              </div>
              {actions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune action de développement planifiée. Cliquez sur &ldquo;Ajouter&rdquo;.</p>
              ) : (
                <div className="space-y-3">
                  {actions.map((a, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-600">Action {i + 1}</p>
                        <button type="button" onClick={() => setActions(p => p.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                          <Label className="text-xs text-slate-600">Titre *</Label>
                          <Input value={a.titre} onChange={e => setActions(p => p.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))}
                            placeholder="Ex: Formation Excel avancé" className="text-xs h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-600">Type</Label>
                          <Select value={a.type} onValueChange={v => setActions(p => p.map((x, j) => j === i ? { ...x, type: v } : x))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-600">Échéance</Label>
                          <Input type="date" value={a.echeance} onChange={e => setActions(p => p.map((x, j) => j === i ? { ...x, echeance: e.target.value } : x))}
                            className="text-xs h-8" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commentaire général */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Commentaire général</p>
              <Textarea rows={3} placeholder="Points forts, axes d'amélioration, bilan de la période…" value={form.commentaire}
                onChange={e => setForm(p => ({ ...p, commentaire: e.target.value }))} />
            </div>

            {/* Submit */}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => { resetForm(); setTab("liste") }}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">
                Annuler
              </button>
              <button type="button" disabled={saving} onClick={e => handleSubmit(e as unknown as React.FormEvent, "BROUILLON")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <FileText className="h-3.5 w-3.5" /> Sauvegarder en brouillon
              </button>
              <button type="button" disabled={saving} onClick={e => handleSubmit(e as unknown as React.FormEvent, "FINALISE")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Check className="h-3.5 w-3.5" /> Finaliser
              </button>
              <button type="submit" disabled={saving || !form.employeId || !form.periode || notes.every(n => n.note === 0)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Send className="h-3.5 w-3.5" /> Publier l'évaluation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
