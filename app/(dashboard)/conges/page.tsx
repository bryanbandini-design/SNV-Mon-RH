"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Calendar, Check, X, Loader2, Clock, Trash2,
  Filter, BarChart2, CheckSquare, Square, CheckCheck,
  ChevronLeft, ChevronRight, LayoutList, CalendarDays,
} from "lucide-react"
import { formatDate, TYPES_CONGE, MOIS } from "@/lib/utils"
import { toast } from "sonner"

type Employe = { id: string; prenom: string; nom: string; matricule: string; soldeCongesAnnuels: number }
type Conge = {
  id: string; type: string; dateDebut: string; dateFin: string
  nbJours: number; motif: string | null; statut: string; commentaire: string | null
  employe: { id: string; prenom: string; nom: string; matricule: string }
}

const STATUT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  APPROUVE:   { bg: "#ecfdf5", text: "#059669", label: "Approuvé"   },
  REFUSE:     { bg: "#fef2f2", text: "#dc2626", label: "Refusé"     },
  EN_ATTENTE: { bg: "#fffbeb", text: "#d97706", label: "En attente" },
}

const TYPE_COLOR: Record<string, string> = {
  ANNUEL: "#3b82f6", MALADIE: "#ef4444", MATERNITE: "#ec4899",
  PATERNITE: "#8b5cf6", SANS_SOLDE: "#64748b", EXCEPTIONNEL: "#f97316",
}

function initiales(e: { prenom: string; nom: string }) { return e.prenom[0] + e.nom[0] }

export default function CongesPage() {
  const [conges, setConges]     = useState<Conge[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [form, setForm] = useState({ employeId: "", type: "", dateDebut: "", dateFin: "", motif: "" })

  // Filtres
  const [filtreEmp,    setFiltreEmp]    = useState("TOUS")
  const [filtreType,   setFiltreType]   = useState("TOUS")
  const [filtreStatut, setFiltreStatut] = useState("TOUS")

  // Action individuelle
  const [actionId,     setActionId]     = useState<string | null>(null)
  const [actionStatut, setActionStatut] = useState<"APPROUVE" | "REFUSE" | null>(null)
  const [commentaire,  setCommentaire]  = useState("")

  // Sélection en masse
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Vue calendrier
  const [viewMode, setViewMode]         = useState<"liste" | "calendrier">("liste")
  const [calMonth, setCalMonth]         = useState(() => new Date().getMonth())
  const [calYear,  setCalYear]          = useState(() => new Date().getFullYear())

  useEffect(() => {
    Promise.all([
      fetch("/api/conges").then(r => r.ok ? r.json() : []),
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
    ]).then(([c, e]) => {
      if (Array.isArray(c)) setConges(c)
      if (Array.isArray(e)) setEmployes(e)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/conges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const n = await res.json()
      const emp = employes.find(x => x.id === form.employeId)
      setConges(prev => [{ ...n, employe: { ...emp!, id: emp!.id } }, ...prev])
      setShowForm(false)
      setForm({ employeId: "", type: "", dateDebut: "", dateFin: "", motif: "" })
      toast.success("Demande de congé enregistrée")
    } else { toast.error("Erreur lors de l'enregistrement") }
    setLoading(false)
  }

  function demanderAction(id: string, statut: "APPROUVE" | "REFUSE") {
    setActionId(id); setActionStatut(statut); setCommentaire("")
  }

  async function confirmerAction() {
    if (!actionId || !actionStatut) return
    const res = await fetch(`/api/conges/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: actionStatut, commentaire: commentaire || null }),
    })
    if (res.ok) {
      setConges(prev => prev.map(c => c.id === actionId ? { ...c, statut: actionStatut, commentaire } : c))
      toast.success(actionStatut === "APPROUVE" ? "Congé approuvé ✓" : "Congé refusé")
    }
    setActionId(null); setActionStatut(null); setCommentaire("")
  }

  async function supprimerConge(id: string) {
    if (!confirm("Supprimer cette demande de congé ?")) return
    const res = await fetch(`/api/conges/${id}`, { method: "DELETE" })
    if (res.ok) { setConges(prev => prev.filter(c => c.id !== id)); toast.success("Demande supprimée") }
    else toast.error("Erreur lors de la suppression")
  }

  async function approuverEnMasse() {
    if (selected.size === 0) return
    setBulkLoading(true)
    const res = await fetch("/api/conges/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], statut: "APPROUVE" }),
    })
    if (res.ok) {
      const { updated } = await res.json()
      setConges(prev => prev.map(c => selected.has(c.id) ? { ...c, statut: "APPROUVE" } : c))
      setSelected(new Set())
      toast.success(`${updated} congé(s) approuvé(s) ✓`)
    } else toast.error("Erreur lors de l'approbation en masse")
    setBulkLoading(false)
  }

  async function refuserEnMasse() {
    if (selected.size === 0) return
    setBulkLoading(true)
    const res = await fetch("/api/conges/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], statut: "REFUSE" }),
    })
    if (res.ok) {
      const { updated } = await res.json()
      setConges(prev => prev.map(c => selected.has(c.id) ? { ...c, statut: "REFUSE" } : c))
      setSelected(new Set())
      toast.success(`${updated} congé(s) refusé(s)`)
    } else toast.error("Erreur lors du refus en masse")
    setBulkLoading(false)
  }

  // Solde par employé
  const soldes = useMemo(() => {
    const year = new Date().getFullYear()
    const map: Record<string, { pris: number; solde: number }> = {}
    for (const emp of employes) {
      const pris = conges
        .filter(c => c.employe.id === emp.id && c.type === "ANNUEL" && c.statut === "APPROUVE"
          && new Date(c.dateDebut).getFullYear() === year)
        .reduce((s, c) => s + c.nbJours, 0)
      map[emp.id] = { pris, solde: emp.soldeCongesAnnuels - pris }
    }
    return map
  }, [conges, employes])

  const filtered = useMemo(() => conges.filter(c => {
    if (filtreEmp    !== "TOUS" && c.employe.id !== filtreEmp)    return false
    if (filtreType   !== "TOUS" && c.type        !== filtreType)   return false
    if (filtreStatut !== "TOUS" && c.statut      !== filtreStatut) return false
    return true
  }), [conges, filtreEmp, filtreType, filtreStatut])

  const enAttente  = filtered.filter(c => c.statut === "EN_ATTENTE")
  const historique = filtered.filter(c => c.statut !== "EN_ATTENTE")
  const hasFiltre  = filtreEmp !== "TOUS" || filtreType !== "TOUS" || filtreStatut !== "TOUS"

  const allSelected  = enAttente.length > 0 && enAttente.every(c => selected.has(c.id))
  const someSelected = enAttente.some(c => selected.has(c.id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(enAttente.map(c => c.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const nbJoursPrev = form.dateDebut && form.dateFin
    ? Math.max(0, Math.ceil((new Date(form.dateFin).getTime() - new Date(form.dateDebut).getTime()) / 86400000) + 1)
    : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Congés & Absences</h1>
          <p className="text-sm text-slate-500 mt-1">
            {conges.filter(c => c.statut === "EN_ATTENTE").length > 0
              ? <span className="text-amber-600 font-medium">{conges.filter(c => c.statut === "EN_ATTENTE").length} demande(s) en attente</span>
              : "Toutes les demandes sont traitées"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle liste / calendrier */}
          <div className="flex p-1 bg-slate-100 rounded-lg gap-0.5">
            <button onClick={() => setViewMode("liste")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "liste" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <LayoutList className="h-3.5 w-3.5" /> Liste
            </button>
            <button onClick={() => setViewMode("calendrier")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "calendrier" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendrier
            </button>
          </div>
          <button onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            <BarChart2 className="h-4 w-4" />
            Soldes
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <Plus className="h-4 w-4" />
            Nouvelle demande
          </button>
        </div>
      </div>

      {/* Soldes annuels */}
      {showStats && employes.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-4">
            Soldes congés annuels — {new Date().getFullYear()}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {employes.map(emp => {
              const s = soldes[emp.id]
              if (!s) return null
              const pct   = Math.min(100, Math.round((s.pris / emp.soldeCongesAnnuels) * 100))
              const color = s.solde <= 0 ? "#ef4444" : s.solde <= 5 ? "#f97316" : "#10b981"
              return (
                <div key={emp.id} className="bg-white rounded-lg border border-blue-100 p-3">
                  <p className="text-xs font-semibold text-slate-800 truncate">{emp.prenom} {emp.nom}</p>
                  <div className="flex items-end justify-between mt-2 mb-1.5">
                    <span className="text-xs text-slate-400">{s.pris}j pris</span>
                    <span className="text-sm font-black" style={{ color }}>{s.solde}j restants</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Droit : {emp.soldeCongesAnnuels}j / an</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulaire nouvelle demande */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
          <h2 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            Nouvelle demande de congé
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Employé *</Label>
              <Select value={form.employeId} onValueChange={v => setForm(p => ({ ...p, employeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
              </Select>
              {form.employeId && soldes[form.employeId] && (
                <p className="text-xs text-blue-600 font-medium">
                  Solde disponible : {soldes[form.employeId].solde}j (annuels)
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Type *</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>{TYPES_CONGE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date début *</Label>
              <Input type="date" value={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateDebut: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date fin *</Label>
              <Input type="date" value={form.dateFin} min={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateFin: e.target.value }))} required />
            </div>
            {nbJoursPrev > 0 && (
              <div className="col-span-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Durée : <strong>{nbJoursPrev} jour(s)</strong>
              </div>
            )}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium text-slate-600">Motif</Label>
              <Textarea value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} rows={2} placeholder="Motif optionnel…" />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={loading || !form.employeId || !form.type || !form.dateDebut || !form.dateFin}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#f59e0b" }}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
        <div className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Filter className="h-3.5 w-3.5" />
          Filtrer :
        </div>
        <Select value={filtreEmp} onValueChange={setFiltreEmp}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-44"><SelectValue placeholder="Employé" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les employés</SelectItem>
            {employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreType} onValueChange={setFiltreType}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les types</SelectItem>
            {TYPES_CONGE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les statuts</SelectItem>
            <SelectItem value="EN_ATTENTE">En attente</SelectItem>
            <SelectItem value="APPROUVE">Approuvé</SelectItem>
            <SelectItem value="REFUSE">Refusé</SelectItem>
          </SelectContent>
        </Select>
        <div className="col-span-2 flex items-center justify-between">
          {hasFiltre && (
            <button onClick={() => { setFiltreEmp("TOUS"); setFiltreType("TOUS"); setFiltreStatut("TOUS") }}
              className="text-xs text-slate-400 hover:text-slate-700 underline">
              Réinitialiser
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">{filtered.length} résultat(s)</span>
        </div>
      </div>

      {/* Modal commentaire individuel */}
      {actionId && actionStatut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-slate-900 mb-1">
              {actionStatut === "APPROUVE" ? "✓ Approuver le congé" : "✗ Refuser le congé"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">Commentaire optionnel transmis à l&apos;employé.</p>
            <Textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3}
              placeholder={actionStatut === "APPROUVE" ? "Ex : Bon congé !" : "Ex : Période de forte activité…"} />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setActionId(null); setActionStatut(null) }}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={confirmerAction}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: actionStatut === "APPROUVE" ? "#10b981" : "#ef4444" }}>
                {actionStatut === "APPROUVE" ? "Confirmer l'approbation" : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demandes en attente */}
      {enAttente.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              En attente de validation
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{enAttente.length}</span>
            </h2>

            {/* Barre d'actions en masse */}
            {someSelected && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">{selected.size} sélectionné(s)</span>
                <button onClick={approuverEnMasse} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: "#10b981" }}>
                  {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                  Tout approuver
                </button>
                <button onClick={refuserEnMasse} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: "#ef4444" }}>
                  {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Tout refuser
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-slate-600">
                  Désélectionner
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {enAttente.map(c => {
              const empSolde  = soldes[c.employe.id]
              const isChecked = selected.has(c.id)
              return (
                <div key={c.id}
                  className={`flex items-center gap-4 bg-white rounded-xl border px-5 py-4 shadow-sm transition-all ${isChecked ? "border-indigo-300 ring-1 ring-indigo-200" : "border-amber-100"}`}
                  style={{ borderLeftWidth: "4px", borderLeftColor: TYPE_COLOR[c.type] ?? "#94a3b8" }}>

                  {/* Checkbox sélection */}
                  <button onClick={() => toggleOne(c.id)}
                    className="flex-shrink-0 text-slate-400 hover:text-indigo-600 transition-colors">
                    {isChecked
                      ? <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                      : <Square className="h-4.5 w-4.5" />}
                  </button>

                  <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                    {initiales(c.employe)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{c.employe.prenom} {c.employe.nom}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: (TYPE_COLOR[c.type] ?? "#94a3b8") + "20", color: TYPE_COLOR[c.type] ?? "#64748b" }}>
                        {c.type}
                      </span>
                      {c.type === "ANNUEL" && empSolde && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          empSolde.solde >= c.nbJours ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          Solde : {empSolde.solde}j restants
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(c.dateDebut)} → {formatDate(c.dateFin)} · <strong>{c.nbJours} jour(s)</strong>
                      {c.motif && <span className="italic"> · &quot;{c.motif}&quot;</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => demanderAction(c.id, "APPROUVE")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: "#10b981" }}>
                      <Check className="h-3.5 w-3.5" /> Approuver
                    </button>
                    <button onClick={() => demanderAction(c.id, "REFUSE")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: "#ef4444" }}>
                      <X className="h-3.5 w-3.5" /> Refuser
                    </button>
                    <button onClick={() => supprimerConge(c.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Sélectionner tout */}
            {enAttente.length > 1 && (
              <button onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-600 transition-colors px-1 py-0.5">
                {allSelected
                  ? <><CheckSquare className="h-3.5 w-3.5 text-indigo-600" /> Tout désélectionner</>
                  : <><Square className="h-3.5 w-3.5" /> Tout sélectionner ({enAttente.length})</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Vue Calendrier ────────────────────────────────────────── */}
      {viewMode === "calendrier" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Nav mois */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <button onClick={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
              else setCalMonth(m => m - 1)
            }} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900">
              {MOIS[calMonth]} {calYear}
            </h2>
            <button onClick={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
              else setCalMonth(m => m + 1)
            }} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grille jours */}
          {(() => {
            const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
            const firstDay = new Date(calYear, calMonth, 1)
            const lastDay  = new Date(calYear, calMonth + 1, 0)
            // Décalage : lundi = 0
            const startOffset = (firstDay.getDay() + 6) % 7
            const totalCells  = startOffset + lastDay.getDate()
            const rows        = Math.ceil(totalCells / 7)

            // Congés approuvés du mois
            const congesDuMois = conges.filter(c => {
              if (c.statut !== "APPROUVE") return false
              const debut = new Date(c.dateDebut)
              const fin   = new Date(c.dateFin)
              const moisStart = new Date(calYear, calMonth, 1)
              const moisEnd   = new Date(calYear, calMonth + 1, 0)
              return debut <= moisEnd && fin >= moisStart
            })

            // Pour chaque jour, les congés actifs
            function congesPourJour(jour: number) {
              const date = new Date(calYear, calMonth, jour)
              return congesDuMois.filter(c => {
                const d = new Date(c.dateDebut); d.setHours(0,0,0,0)
                const f = new Date(c.dateFin);   f.setHours(23,59,59,999)
                return date >= d && date <= f
              })
            }

            const today = new Date()
            const isToday = (j: number) =>
              today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === j

            return (
              <div className="p-4">
                {/* En-têtes jours */}
                <div className="grid grid-cols-7 mb-1">
                  {JOURS.map(j => (
                    <div key={j} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide py-1">{j}</div>
                  ))}
                </div>

                {/* Cases */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: rows * 7 }).map((_, idx) => {
                    const jour = idx - startOffset + 1
                    if (jour < 1 || jour > lastDay.getDate()) {
                      return <div key={idx} className="h-20 rounded-lg" style={{ background: "#f8fafc" }} />
                    }
                    const cs = congesPourJour(jour)
                    return (
                      <div key={idx}
                        className={`h-20 rounded-lg p-1.5 border transition-colors ${isToday(jour) ? "border-indigo-400" : "border-slate-100"}`}
                        style={{ background: isToday(jour) ? "rgba(99,102,241,0.05)" : "#fff" }}>
                        <p className={`text-xs font-semibold mb-1 ${isToday(jour) ? "text-indigo-600" : "text-slate-600"}`}>
                          {jour}
                        </p>
                        <div className="space-y-0.5 overflow-hidden">
                          {cs.slice(0, 2).map(c => (
                            <div key={c.id}
                              className="text-[9px] font-medium px-1 py-0.5 rounded truncate"
                              style={{ background: (TYPE_COLOR[c.type] ?? "#94a3b8") + "25", color: TYPE_COLOR[c.type] ?? "#64748b" }}
                              title={`${c.employe.prenom} ${c.employe.nom} — ${c.type}`}>
                              {c.employe.prenom[0]}. {c.employe.nom}
                            </div>
                          ))}
                          {cs.length > 2 && (
                            <div className="text-[9px] text-slate-400 px-1">+{cs.length - 2}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Légende */}
                {congesDuMois.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    {[...new Set(congesDuMois.map(c => c.type))].map(type => (
                      <span key={type} className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: (TYPE_COLOR[type] ?? "#94a3b8") + "20", color: TYPE_COLOR[type] ?? "#64748b" }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[type] ?? "#94a3b8" }} />
                        {type}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {congesDuMois.length} congé(s) approuvé(s) ce mois
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Historique (uniquement en vue liste) */}
      {viewMode === "liste" && (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            Historique des congés
          </h2>
          <span className="text-xs text-slate-400">{historique.length} enregistrement(s)</span>
        </div>
        {historique.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{hasFiltre ? "Aucun résultat pour ces filtres" : "Aucun congé traité"}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Employé", "Type", "Période", "Jours", "Commentaire RH", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historique.map(c => {
                const st = STATUT_STYLE[c.statut] ?? STATUT_STYLE.EN_ATTENTE
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #94a3b8, #64748b)" }}>
                          {initiales(c.employe)}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{c.employe.prenom} {c.employe.nom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: (TYPE_COLOR[c.type] ?? "#94a3b8") + "20", color: TYPE_COLOR[c.type] ?? "#64748b" }}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600 whitespace-nowrap">{formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</td>
                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-700">{c.nbJours}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 max-w-[180px]">
                      {c.commentaire ? <span className="italic">&quot;{c.commentaire}&quot;</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <button onClick={() => supprimerConge(c.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  )
}
