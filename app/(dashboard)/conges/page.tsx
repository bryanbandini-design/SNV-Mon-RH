"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Calendar, Check, X, Loader2, Clock, Trash2,
  ChevronDown, ChevronUp, Filter, BarChart2,
} from "lucide-react"
import { formatDate, TYPES_CONGE } from "@/lib/utils"
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

  // Filtre
  const [filtreEmp,    setFiltreEmp]    = useState("TOUS")
  const [filtreType,   setFiltreType]   = useState("TOUS")
  const [filtreStatut, setFiltreStatut] = useState("TOUS")

  // Commentaire inline lors d'une action
  const [actionId,    setActionId]    = useState<string | null>(null)
  const [actionStatut, setActionStatut] = useState<"APPROUVE" | "REFUSE" | null>(null)
  const [commentaire, setCommentaire] = useState("")

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
    setActionId(id)
    setActionStatut(statut)
    setCommentaire("")
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
    setActionId(null)
    setActionStatut(null)
    setCommentaire("")
  }

  async function supprimerConge(id: string) {
    if (!confirm("Supprimer cette demande de congé ?")) return
    const res = await fetch(`/api/conges/${id}`, { method: "DELETE" })
    if (res.ok) {
      setConges(prev => prev.filter(c => c.id !== id))
      toast.success("Demande supprimée")
    } else { toast.error("Erreur lors de la suppression") }
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

  // Filtres appliqués
  const filtered = useMemo(() => conges.filter(c => {
    if (filtreEmp    !== "TOUS" && c.employe.id !== filtreEmp)    return false
    if (filtreType   !== "TOUS" && c.type        !== filtreType)   return false
    if (filtreStatut !== "TOUS" && c.statut      !== filtreStatut) return false
    return true
  }), [conges, filtreEmp, filtreType, filtreStatut])

  const enAttente = filtered.filter(c => c.statut === "EN_ATTENTE")
  const historique = filtered.filter(c => c.statut !== "EN_ATTENTE")
  const hasFiltre  = filtreEmp !== "TOUS" || filtreType !== "TOUS" || filtreStatut !== "TOUS"

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
              const pct = Math.min(100, Math.round((s.pris / emp.soldeCongesAnnuels) * 100))
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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Filter className="h-3.5 w-3.5" />
          Filtrer :
        </div>
        <Select value={filtreEmp} onValueChange={setFiltreEmp}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Employé" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les employés</SelectItem>
            {employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreType} onValueChange={setFiltreType}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les types</SelectItem>
            {TYPES_CONGE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les statuts</SelectItem>
            <SelectItem value="EN_ATTENTE">En attente</SelectItem>
            <SelectItem value="APPROUVE">Approuvé</SelectItem>
            <SelectItem value="REFUSE">Refusé</SelectItem>
          </SelectContent>
        </Select>
        {hasFiltre && (
          <button onClick={() => { setFiltreEmp("TOUS"); setFiltreType("TOUS"); setFiltreStatut("TOUS") }}
            className="text-xs text-slate-400 hover:text-slate-700 underline">
            Réinitialiser
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} résultat(s)</span>
      </div>

      {/* Modal commentaire */}
      {actionId && actionStatut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-slate-900 mb-1">
              {actionStatut === "APPROUVE" ? "✓ Approuver le congé" : "✗ Refuser le congé"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">Ajoutez un commentaire (optionnel) qui sera transmis à l&apos;employé.</p>
            <Textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              rows={3}
              placeholder={actionStatut === "APPROUVE" ? "Ex : Bon congé !" : "Ex : Période de forte activité, merci de reporter…"}
            />
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
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            En attente de validation
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{enAttente.length}</span>
          </h2>
          <div className="space-y-2">
            {enAttente.map(c => {
              const empSolde = soldes[c.employe.id]
              return (
                <div key={c.id} className="flex items-center gap-4 bg-white rounded-xl border border-amber-100 px-5 py-4 shadow-sm"
                  style={{ borderLeftWidth: "4px", borderLeftColor: TYPE_COLOR[c.type] ?? "#94a3b8" }}>
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
          </div>
        </div>
      )}

      {/* Historique */}
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
    </div>
  )
}
