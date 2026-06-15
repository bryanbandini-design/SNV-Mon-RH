"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Star, TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { CRITERES_EVALUATION, NOTES_LABELS } from "@/lib/utils"
import { toast } from "sonner"

type Employe = { id: string; prenom: string; nom: string; matricule: string; poste: string }
type NoteEval = { critere: string; note: number; commentaire: string }
type Evaluation = {
  id: string; periode: string; dateEval: string; evaluateur: string
  scoreGlobal: number; commentaire: string | null; statut: string
  employe: { prenom: string; nom: string; matricule: string; poste: string }
  notes: { critere: string; note: number; commentaire: string | null }[]
}

function scoreStyle(s: number) {
  if (s >= 4) return { color: "#059669", bg: "#ecfdf5", ring: "#bbf7d0" }
  if (s >= 3) return { color: "#d97706", bg: "#fffbeb", ring: "#fde68a" }
  return { color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" }
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
      {value > 0 && <span className="ml-1.5 text-xs text-slate-500">{NOTES_LABELS[value]}</span>}
    </div>
  )
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`h-3.5 w-3.5 ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
      ))}
    </div>
  )
}

export default function EvaluationsPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const initNotes = () => CRITERES_EVALUATION.map(c => ({ critere: c.id, note: 0, commentaire: "" }))

  const [form, setForm] = useState({
    employeId: "", periode: "", dateEval: new Date().toISOString().split("T")[0],
    evaluateur: "", commentaire: "",
  })
  const [notes, setNotes] = useState<NoteEval[]>(initNotes())

  useEffect(() => {
    Promise.all([
      fetch("/api/evaluations").then(r => r.ok ? r.json() : []),
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
    ]).then(([e, emp]) => {
      if (Array.isArray(e)) setEvaluations(e)
      if (Array.isArray(emp)) setEmployes(emp)
    })
  }, [])

  function updateNote(critere: string, note: number) {
    setNotes(prev => prev.map(n => n.critere === critere ? { ...n, note } : n))
  }
  function updateNoteComment(critere: string, commentaire: string) {
    setNotes(prev => prev.map(n => n.critere === critere ? { ...n, commentaire } : n))
  }

  const notedCount = notes.filter(n => n.note > 0).length
  const scorePreview = notedCount > 0
    ? (notes.filter(n => n.note > 0).reduce((a, n) => a + n.note, 0) / notedCount)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, notes: notes.filter(n => n.note > 0), statut: "FINALISE" }),
    })
    if (res.ok) {
      const newEval = await res.json()
      const emp = employes.find(x => x.id === form.employeId)
      setEvaluations(prev => [{ ...newEval, employe: emp! }, ...prev])
      setShowForm(false)
      setForm({ employeId: "", periode: "", dateEval: new Date().toISOString().split("T")[0], evaluateur: "", commentaire: "" })
      setNotes(initNotes())
      toast.success("Évaluation enregistrée")
    } else { toast.error("Erreur lors de l'enregistrement") }
    setLoading(false)
  }

  const moyenneGlobale = evaluations.length > 0
    ? evaluations.reduce((a, e) => a + e.scoreGlobal, 0) / evaluations.length
    : null

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Évaluations de performance</h1>
          <p className="text-sm text-slate-500 mt-1">
            {evaluations.length} évaluation(s)
            {moyenneGlobale && (
              <span> · Moyenne : <strong style={{ color: scoreStyle(moyenneGlobale).color }}>{moyenneGlobale.toFixed(1)}/5</strong></span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
        >
          <Plus className="h-4 w-4" />
          Nouvelle évaluation
        </button>
      </div>

      {/* ── Formulaire ─────────────────────────────── */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-6">
          <h2 className="font-semibold text-slate-900 text-sm mb-5 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            Nouvelle évaluation de performance
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Employé *</Label>
                <Select value={form.employeId} onValueChange={v => setForm(p => ({ ...p, employeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Période évaluée *</Label>
                <Input placeholder="ex: T2 2025, Annuel 2025" value={form.periode} onChange={e => setForm(p => ({ ...p, periode: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Date de l&apos;évaluation *</Label>
                <Input type="date" value={form.dateEval} onChange={e => setForm(p => ({ ...p, dateEval: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Évaluateur *</Label>
                <Input placeholder="Votre nom" value={form.evaluateur} onChange={e => setForm(p => ({ ...p, evaluateur: e.target.value }))} required />
              </div>
            </div>

            {/* Score preview */}
            {scorePreview !== null && (
              <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: scoreStyle(scorePreview).bg }}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-sm"
                  style={{ background: "white", color: scoreStyle(scorePreview).color, border: `2px solid ${scoreStyle(scorePreview).ring}` }}>
                  {scorePreview.toFixed(1)}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Score préliminaire ({notedCount}/{CRITERES_EVALUATION.length} critères)</p>
                  <StarDisplay value={Math.round(scorePreview)} />
                </div>
              </div>
            )}

            {/* Critères */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Critères d&apos;évaluation</p>
              <div className="space-y-2">
                {CRITERES_EVALUATION.map(c => {
                  const n = notes.find(x => x.critere === c.id)!
                  return (
                    <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
                        </div>
                        <StarRating value={n.note} onChange={v => updateNote(c.id, v)} />
                      </div>
                      {n.note > 0 && (
                        <Input placeholder="Commentaire sur ce critère (optionnel)" value={n.commentaire}
                          onChange={e => updateNoteComment(c.id, e.target.value)} className="text-sm h-8" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Commentaire général</Label>
              <Textarea rows={3} placeholder="Points forts, axes d'amélioration, objectifs..." value={form.commentaire}
                onChange={e => setForm(p => ({ ...p, commentaire: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setShowForm(false); setNotes(initNotes()) }}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">
                Annuler
              </button>
              <button type="submit" disabled={loading || !form.employeId || !form.periode || notes.every(n => n.note === 0)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#8b5cf6" }}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer l&apos;évaluation
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Liste ──────────────────────────────────── */}
      {evaluations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white text-center py-16">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-200" />
          <p className="font-medium text-slate-500">Aucune évaluation enregistrée</p>
          <p className="text-sm text-slate-400 mt-1">Cliquez sur &quot;Nouvelle évaluation&quot; pour commencer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map(ev => {
            const st = scoreStyle(ev.scoreGlobal)
            const isExpanded = expanded === ev.id
            return (
              <div key={ev.id} className="rounded-xl border bg-white overflow-hidden transition-shadow hover:shadow-sm"
                style={{ borderColor: st.ring }}>
                {/* Top color bar */}
                <div className="h-1" style={{ background: st.color }} />
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Score circle */}
                    <div className="h-14 w-14 rounded-full flex flex-col items-center justify-center flex-shrink-0 border-2"
                      style={{ background: st.bg, borderColor: st.ring }}>
                      <span className="text-lg font-black leading-none" style={{ color: st.color }}>{ev.scoreGlobal.toFixed(1)}</span>
                      <span className="text-xs" style={{ color: st.color }}>/5</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{ev.employe.prenom} {ev.employe.nom}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-500">{ev.employe.poste}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{ev.periode}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <StarDisplay value={Math.round(ev.scoreGlobal)} />
                        <span className="text-xs text-slate-400">Évalué par {ev.evaluateur}</span>
                      </div>
                    </div>
                    {/* Expand button */}
                    <button onClick={() => setExpanded(isExpanded ? null : ev.id)}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors flex-shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {ev.notes.map(n => {
                          const critere = CRITERES_EVALUATION.find(c => c.id === n.critere)
                          return (
                            <div key={n.critere} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                              <span className="text-xs font-medium text-slate-700">{critere?.label ?? n.critere}</span>
                              <div className="flex items-center gap-1.5">
                                <StarDisplay value={n.note} />
                                <span className="text-xs text-slate-400 font-medium">{n.note}/5</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {ev.commentaire && (
                        <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-3">
                          <p className="text-xs text-purple-500 font-medium mb-1">Commentaire général</p>
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
  )
}
