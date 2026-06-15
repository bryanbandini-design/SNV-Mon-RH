"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, DollarSign, Loader2, Check, TrendingUp, Clock,
  Pencil, Trash2, X, Filter,
} from "lucide-react"
import { formatCurrency, MOIS } from "@/lib/utils"
import { toast } from "sonner"

type Employe = { id: string; prenom: string; nom: string; matricule: string; poste: string; salaireBase: number }
type Salaire = {
  id: string; mois: number; annee: number; salaireBase: number
  primes: number; retenues: number; netAPayer: number
  statut: string; datePaiement: string | null; notes: string | null
  employe: { id: string; prenom: string; nom: string; matricule: string; poste: string }
}

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)

function initiales(e: { prenom: string; nom: string }) { return e.prenom[0] + e.nom[0] }

const emptyForm = (currentMonth: number, currentYear: number) => ({
  employeId: "", mois: String(currentMonth), annee: String(currentYear),
  salaireBase: "", primes: "0", retenues: "0", notes: "",
})

export default function SalairesPage() {
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading]   = useState(false)

  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [form, setForm] = useState(emptyForm(currentMonth, currentYear))
  const [editId, setEditId] = useState<string | null>(null)

  // Filtres
  const [filtreMois,   setFiltreMois]   = useState("TOUS")
  const [filtreAnnee,  setFiltreAnnee]  = useState("TOUS")
  const [filtreEmp,    setFiltreEmp]    = useState("TOUS")
  const [filtreStatut, setFiltreStatut] = useState("TOUS")

  useEffect(() => {
    Promise.all([
      fetch("/api/salaires").then(r => r.ok ? r.json() : []),
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
    ]).then(([s, e]) => {
      if (Array.isArray(s)) setSalaires(s)
      if (Array.isArray(e)) setEmployes(e)
    })
  }, [])

  function handleEmployeChange(id: string) {
    const emp = employes.find(e => e.id === id)
    setForm(p => ({ ...p, employeId: id, salaireBase: emp ? String(emp.salaireBase) : "" }))
  }

  function startEdit(s: Salaire) {
    setEditId(s.id)
    setForm({
      employeId:   s.employe.id,
      mois:        String(s.mois),
      annee:       String(s.annee),
      salaireBase: String(s.salaireBase),
      primes:      String(s.primes),
      retenues:    String(s.retenues),
      notes:       s.notes ?? "",
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm(currentMonth, currentYear))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const url    = editId ? `/api/salaires/${editId}` : "/api/salaires"
    const method = editId ? "PATCH" : "POST"
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const n = await res.json()
      const emp = employes.find(x => x.id === form.employeId)!
      const enriched = { ...n, employe: { id: emp.id, prenom: emp.prenom, nom: emp.nom, matricule: emp.matricule, poste: emp.poste } }
      if (editId) {
        setSalaires(prev => prev.map(s => s.id === editId ? enriched : s))
        toast.success("Fiche modifiée")
      } else {
        setSalaires(prev => [enriched, ...prev])
        toast.success("Fiche de salaire créée")
      }
      cancelForm()
    } else { toast.error("Erreur lors de l'enregistrement") }
    setLoading(false)
  }

  async function marquerPaye(id: string) {
    const res = await fetch(`/api/salaires/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "PAYE" }),
    })
    if (res.ok) {
      setSalaires(prev => prev.map(s => s.id === id ? { ...s, statut: "PAYE", datePaiement: new Date().toISOString() } : s))
      toast.success("Salaire marqué comme payé")
    }
  }

  async function supprimerSalaire(id: string) {
    if (!confirm("Supprimer cette fiche de salaire ?")) return
    const res = await fetch(`/api/salaires/${id}`, { method: "DELETE" })
    if (res.ok) {
      setSalaires(prev => prev.filter(s => s.id !== id))
      toast.success("Fiche supprimée")
    } else { toast.error("Erreur lors de la suppression") }
  }

  // Filtres
  const filtered = useMemo(() => salaires.filter(s => {
    if (filtreMois   !== "TOUS" && String(s.mois)        !== filtreMois)   return false
    if (filtreAnnee  !== "TOUS" && String(s.annee)       !== filtreAnnee)  return false
    if (filtreEmp    !== "TOUS" && s.employe.id          !== filtreEmp)    return false
    if (filtreStatut !== "TOUS" && s.statut              !== filtreStatut) return false
    return true
  }), [salaires, filtreMois, filtreAnnee, filtreEmp, filtreStatut])

  const hasFiltre = filtreMois !== "TOUS" || filtreAnnee !== "TOUS" || filtreEmp !== "TOUS" || filtreStatut !== "TOUS"
  const enAttente  = salaires.filter(s => s.statut === "EN_ATTENTE")
  const netPending = enAttente.reduce((a, s) => a + s.netAPayer, 0)
  const netPaye    = salaires.filter(s => s.statut === "PAYE").reduce((a, s) => a + s.netAPayer, 0)
  const netTotal   = salaires.reduce((a, s) => a + s.netAPayer, 0)
  const previewNet = form.salaireBase
    ? parseFloat(form.salaireBase) + parseFloat(form.primes || "0") - parseFloat(form.retenues || "0")
    : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salaires & Paie</h1>
          <p className="text-sm text-slate-500 mt-1">{salaires.length} fiche(s) au total</p>
        </div>
        <button
          onClick={() => { setEditId(null); setForm(emptyForm(currentMonth, currentYear)); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
        >
          <Plus className="h-4 w-4" />
          Générer une fiche
        </button>
      </div>

      {/* Summary cards */}
      {salaires.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "À payer",     value: formatCurrency(netPending), sub: `${enAttente.length} fiche(s) en attente`,  icon: Clock,      color: "#f59e0b", bg: "#fffbeb" },
            { label: "Total versé", value: formatCurrency(netPaye),    sub: "fiches payées",                            icon: Check,      color: "#10b981", bg: "#ecfdf5" },
            { label: "Masse salariale totale", value: formatCurrency(netTotal), sub: "toutes fiches confondues",       icon: TrendingUp, color: "#3b82f6", bg: "#eff6ff" },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
                <c.icon className="h-5 w-5" style={{ color: c.color }} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-lg font-black text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-400">{c.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire création / édition */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              {editId ? "Modifier la fiche de salaire" : "Nouvelle fiche de salaire"}
            </h2>
            <button onClick={cancelForm} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 col-span-3">
              <Label className="text-xs font-medium text-slate-600">Employé *</Label>
              <Select value={form.employeId} onValueChange={handleEmployeChange} disabled={!!editId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Mois *</Label>
              <Select value={form.mois} onValueChange={v => setForm(p => ({ ...p, mois: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MOIS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Année *</Label>
              <Select value={form.annee} onValueChange={v => setForm(p => ({ ...p, annee: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Salaire de base *</Label>
              <Input type="number" value={form.salaireBase} onChange={e => setForm(p => ({ ...p, salaireBase: e.target.value }))} min="0" step="1000" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Primes</Label>
              <Input type="number" value={form.primes} onChange={e => setForm(p => ({ ...p, primes: e.target.value }))} min="0" step="1000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Retenues</Label>
              <Input type="number" value={form.retenues} onChange={e => setForm(p => ({ ...p, retenues: e.target.value }))} min="0" step="1000" />
            </div>
            <div className="space-y-1.5 col-span-3">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observations..." />
            </div>
            {previewNet > 0 && (
              <div className="col-span-3 rounded-lg px-4 py-3 flex items-center justify-between" style={{ background: "#ecfdf5" }}>
                <span className="text-sm text-slate-600">Net à payer calculé</span>
                <span className="text-xl font-black" style={{ color: "#059669" }}>{formatCurrency(previewNet)}</span>
              </div>
            )}
            <div className="col-span-3 flex justify-end gap-3">
              <button type="button" onClick={cancelForm} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={loading || !form.employeId || !form.salaireBase}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#10b981" }}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editId ? "Enregistrer les modifications" : "Créer la fiche"}
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
        <Select value={filtreAnnee} onValueChange={setFiltreAnnee}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Toutes</SelectItem>
            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreMois} onValueChange={setFiltreMois}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Mois" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les mois</SelectItem>
            {MOIS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreEmp} onValueChange={setFiltreEmp}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Employé" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les employés</SelectItem>
            {employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les statuts</SelectItem>
            <SelectItem value="EN_ATTENTE">En attente</SelectItem>
            <SelectItem value="PAYE">Payé</SelectItem>
          </SelectContent>
        </Select>
        {hasFiltre && (
          <button onClick={() => { setFiltreMois("TOUS"); setFiltreAnnee("TOUS"); setFiltreEmp("TOUS"); setFiltreStatut("TOUS") }}
            className="text-xs text-slate-400 hover:text-slate-700 underline">
            Réinitialiser
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} fiche(s)</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-slate-900 text-sm">Fiches de salaire</span>
          </div>
          {filtered.length > 0 && (
            <div className="text-xs text-slate-500">
              Total filtré : <span className="font-semibold text-slate-800">{formatCurrency(filtered.reduce((a, s) => a + s.netAPayer, 0))}</span>
            </div>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-slate-500">{hasFiltre ? "Aucun résultat pour ces filtres" : "Aucune fiche de salaire"}</p>
            {!hasFiltre && <p className="text-sm mt-1">Cliquez sur &quot;Générer une fiche&quot; pour commencer</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Employé", "Période", "Base", "± Ajust.", "Net à payer", "Statut", ""].map(h => (
                    <th key={h} className={`px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h === "Net à payer" || h === "Base" || h === "± Ajust." ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => {
                  const ajust = s.primes - s.retenues
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                            {initiales(s.employe)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{s.employe.prenom} {s.employe.nom}</p>
                            <p className="text-xs text-slate-400">{s.employe.poste}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{MOIS[s.mois - 1]} {s.annee}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{formatCurrency(s.salaireBase)}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium" style={{ color: ajust >= 0 ? "#10b981" : "#ef4444" }}>
                        {ajust >= 0 ? "+" : ""}{formatCurrency(ajust)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-base font-black text-slate-900">{formatCurrency(s.netAPayer)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {s.statut === "PAYE" ? "Payé" : "En attente"}
                        </span>
                        {s.datePaiement && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(s.datePaiement).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {s.statut === "EN_ATTENTE" && (
                            <button onClick={() => marquerPaye(s.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                              style={{ borderColor: "#bbf7d0", color: "#059669", background: "#f0fdf4" }}>
                              <Check className="h-3 w-3" /> Payé
                            </button>
                          )}
                          <button onClick={() => startEdit(s)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => supprimerSalaire(s.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
