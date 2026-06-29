"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, DollarSign, Loader2, Check, TrendingUp, Clock,
  Pencil, Trash2, X, Filter, AlertCircle, FileDown, Printer,
  CreditCard,
} from "lucide-react"
import { formatCurrency, MOIS } from "@/lib/utils"
import { toast } from "sonner"
import { calculerSalaire, calculerHS, CAMEROUN, formatFCFA, type DetailsSalaire, type TauxHS } from "@/lib/cameroun-salaire"
import { calculerRetenueAbsence, calculerRetenueRetard } from "@/lib/retenues-calcul"

function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

type Employe = { id: string; prenom: string; nom: string; matricule: string; poste: string; salaireBase: number; statut: string }
type Salaire = {
  id: string; mois: number; annee: number; salaireBase: number
  primes: number; retenues: number; netAPayer: number
  brutImposable: number; cnpsSalarie: number; irpp: number; cac: number; rav: number; cnpsPatronal: number
  heuresSupplementaires: number; montantHS: number; avanceDeduite: number
  joursAbsence: number; retenueAbsence: number
  minutesRetardTotal: number; retenueRetard: number
  statut: string; datePaiement: string | null; notes: string | null
  employe: { id: string; prenom: string; nom: string; matricule: string; poste: string }
}
type Avance = {
  id: string; montant: number; date: string; motif: string | null; statut: string
  employe: { id: string; prenom: string; nom: string; matricule: string; poste: string }
}
type Retenue = {
  id: string; type: string; date: string; montant: number; description: string; statut: string
  employe: { id: string; prenom: string; nom: string; matricule: string; poste: string; salaireBase: number }
  presence: { date: string; minutesRetard: number; statut: string } | null
}

const YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 4 + i)

function initiales(e: { prenom: string; nom: string }) { return e.prenom[0] + e.nom[0] }

const emptyForm = (currentMonth: number, currentYear: number) => ({
  employeId: "", mois: String(currentMonth), annee: String(currentYear),
  salaireBase: "", primes: "0", retenues: "0", notes: "",
  heuresSupplementaires: "0", tauxHS: "NORMAL" as TauxHS,
  joursAbsence: "0", minutesRetardTotal: "0",
})
const emptyAvanceForm = () => ({ employeId: "", montant: "", motif: "", date: new Date().toISOString().split("T")[0] })

export default function SalairesPage() {
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [avances,   setAvances]   = useState<Avance[]>([])
  const [retenues,  setRetenues]  = useState<Retenue[]>([])
  const [retenueValidating, setRetenueValidating] = useState<string | null>(null)
  const [showForm, setShowForm]       = useState(false)
  const [showAvanceForm, setShowAvanceForm] = useState(false)
  const [rattrapageMois,  setRattrapageMois]  = useState(() => String(new Date().getMonth() + 1))
  const [rattrapageAnnee, setRattrapageAnnee] = useState(() => String(new Date().getFullYear()))
  const [avanceSaving, setAvanceSaving] = useState(false)
  const [avanceForm, setAvanceForm]   = useState(emptyAvanceForm())
  const [activeTab, setActiveTab]     = useState<"fiches" | "avances" | "retenues">("fiches")
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
      fetch("/api/avances").then(r => r.ok ? r.json() : []),
      fetch("/api/retenues").then(r => r.ok ? r.json() : []),
    ]).then(([s, e, a, ret]) => {
      if (Array.isArray(ret)) setRetenues(ret)
      if (Array.isArray(s)) setSalaires(s)
      if (Array.isArray(e)) setEmployes(e)
      if (Array.isArray(a)) setAvances(a)
    })
  }, [])

  function handleEmployeChange(id: string) {
    const emp = employes.find(e => e.id === id)
    setForm(p => ({ ...p, employeId: id, salaireBase: emp ? String(emp.salaireBase) : "" }))
  }

  // ── Avances ────────────────────────────────────────────────────────────────
  async function handleAvanceSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAvanceSaving(true)
    const res = await fetch("/api/avances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(avanceForm),
    })
    if (res.ok) {
      const n = await res.json()
      const emp = employes.find(x => x.id === avanceForm.employeId)
      setAvances(prev => [{ ...n, employe: { id: emp!.id, prenom: emp!.prenom, nom: emp!.nom, matricule: emp!.matricule, poste: emp!.poste } }, ...prev])
      setShowAvanceForm(false)
      setAvanceForm(emptyAvanceForm())
      toast.success("Avance enregistrée")
    } else toast.error("Erreur lors de l'enregistrement")
    setAvanceSaving(false)
  }

  async function validerAvance(id: string) {
    const res = await fetch(`/api/avances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "VALIDEE" }),
    })
    if (res.ok) {
      setAvances(prev => prev.map(a => a.id === id ? { ...a, statut: "VALIDEE" } : a))
      toast.success("Avance validée — sera déduite au prochain bulletin")
    } else toast.error("Erreur")
  }

  async function supprimerAvance(id: string) {
    if (!confirm("Supprimer cette avance ?")) return
    const res = await fetch(`/api/avances/${id}`, { method: "DELETE" })
    if (res.ok) { setAvances(prev => prev.filter(a => a.id !== id)); toast.success("Avance supprimée") }
  }


  function startEdit(s: Salaire) {
    setEditId(s.id)
    setForm({
      employeId:             s.employe.id,
      mois:                  String(s.mois),
      annee:                 String(s.annee),
      salaireBase:           String(s.salaireBase),
      primes:                String(s.primes),
      retenues:              String(s.retenues),
      notes:                 s.notes ?? "",
      heuresSupplementaires: String(s.heuresSupplementaires || 0),
      tauxHS:                "NORMAL",
      joursAbsence:          String(s.joursAbsence || 0),
      minutesRetardTotal:    String(s.minutesRetardTotal || 0),
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

  function openBulletin(s: Salaire) {
    const isCapacitor = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    if (isCapacitor) {
      window.location.href = `/print/bulletin/${s.id}`
    } else {
      window.open(`/print/bulletin/${s.id}`, "_blank")
    }
  }

  function exportSalairesCSV() {
    const header = ["Employé", "Matricule", "Poste", "Mois", "Année", "Salaire base", "Primes", "Retenues", "Net à payer", "Statut", "Date paiement"]
    const rows = filtered.map(s => [
      `${s.employe.prenom} ${s.employe.nom}`,
      s.employe.matricule,
      s.employe.poste,
      MOIS[s.mois - 1],
      s.annee,
      s.salaireBase,
      s.primes,
      s.retenues,
      s.netAPayer,
      s.statut,
      s.datePaiement ? new Date(s.datePaiement).toLocaleDateString("fr-FR") : "",
    ])
    downloadCSV([header, ...rows], `salaires_${new Date().toISOString().split("T")[0]}.csv`)
    toast.success(`${filtered.length} fiche(s) exportée(s)`)
  }

  async function supprimerSalaire(id: string) {
    if (!confirm("Supprimer cette fiche de salaire ?")) return
    const res = await fetch(`/api/salaires/${id}`, { method: "DELETE" })
    if (res.ok) {
      setSalaires(prev => prev.filter(s => s.id !== id))
      toast.success("Fiche supprimée")
    } else { toast.error("Erreur lors de la suppression") }
  }

  async function traiterRetenue(id: string, action: "VALIDER" | "ANNULER") {
    setRetenueValidating(id)
    const res = await fetch(`/api/retenues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRetenues(prev => prev.map(r => r.id === id ? { ...r, statut: updated.statut } : r))
      toast.success(action === "VALIDER" ? "Retenue validée" : "Retenue annulée")
    } else { toast.error("Erreur") }
    setRetenueValidating(null)
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

  // Employés sans fiche pour la période de rattrapage sélectionnée
  const rMois  = parseInt(rattrapageMois)
  const rAnnee = parseInt(rattrapageAnnee)
  const idsAvecFichePeriode = new Set(
    salaires.filter(s => s.mois === rMois && s.annee === rAnnee).map(s => s.employe.id)
  )
  const employesSansFiche = employes.filter(e => e.statut === "ACTIF" && !idsAvecFichePeriode.has(e.id))
  const netPending = enAttente.reduce((a, s) => a + s.netAPayer, 0)
  const netPaye    = salaires.filter(s => s.statut === "PAYE").reduce((a, s) => a + s.netAPayer, 0)
  const netTotal   = salaires.reduce((a, s) => a + s.netAPayer, 0)
  const previewHS = form.salaireBase && parseFloat(form.heuresSupplementaires || "0") > 0
    ? calculerHS(parseFloat(form.salaireBase) || 0, parseFloat(form.heuresSupplementaires || "0"), form.tauxHS)
    : 0
  const previewBase = parseFloat(form.salaireBase) || 0
  const previewRetenueAbsence = previewBase > 0 && parseInt(form.joursAbsence || "0") > 0
    ? calculerRetenueAbsence(parseInt(form.joursAbsence || "0"), previewBase)
    : 0
  const previewRetenueRetard = previewBase > 0 && parseInt(form.minutesRetardTotal || "0") > 0
    ? calculerRetenueRetard(parseInt(form.minutesRetardTotal || "0"), previewBase)
    : 0
  const previewTotalAutresRetenues = (parseFloat(form.retenues || "0") || 0) + previewRetenueAbsence + previewRetenueRetard
  const previewCalc: DetailsSalaire | null = previewBase > 0
    ? calculerSalaire(previewBase, parseFloat(form.primes || "0") || 0, previewTotalAutresRetenues, previewHS)
    : null

  // Avances validées non déduites pour l'employé sélectionné
  const avancesEnAttentePourEmploye = useMemo(() =>
    avances.filter(a => a.employe.id === form.employeId && a.statut === "VALIDEE"),
    [avances, form.employeId]
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salaires & Paie</h1>
          <p className="text-sm text-slate-500 mt-1">{salaires.length} fiche(s) au total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {salaires.length > 0 && (
            <button onClick={exportSalairesCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
              <FileDown className="h-4 w-4" />
              CSV
            </button>
          )}
          <button
            onClick={() => { setShowAvanceForm(p => !p); setActiveTab("avances") }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100">
            <CreditCard className="h-4 w-4" />
            Avance
          </button>
          <button
            onClick={() => { setEditId(null); setForm(emptyForm(currentMonth, currentYear)); setShowForm(true); setActiveTab("fiches") }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
            <Plus className="h-4 w-4" />
            Fiche de salaire
          </button>
        </div>
      </div>

      {/* ── Formulaire avance ── */}
      <div className={`transition-all duration-300 overflow-hidden ${showAvanceForm ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-500" />
              Enregistrer une avance sur salaire
            </h2>
            <button onClick={() => setShowAvanceForm(false)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleAvanceSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Employé *</Label>
              <Select value={avanceForm.employeId} onValueChange={v => setAvanceForm(p => ({ ...p, employeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>{employes.filter(e => e.statut === "ACTIF").map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Montant (FCFA) *</Label>
                <Input type="number" value={avanceForm.montant} onChange={e => setAvanceForm(p => ({ ...p, montant: e.target.value }))} min="0" step="1000" required placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Date</Label>
                <Input type="date" value={avanceForm.date} onChange={e => setAvanceForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Motif</Label>
                <Input value={avanceForm.motif} onChange={e => setAvanceForm(p => ({ ...p, motif: e.target.value }))} placeholder="Raison..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowAvanceForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white">Annuler</button>
              <button type="submit" disabled={avanceSaving || !avanceForm.employeId || !avanceForm.montant}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#d97706" }}>
                {avanceSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer l'avance
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bandeau rattrapage / fiches manquantes */}
      <div className="rounded-xl border border-amber-200 px-4 py-4" style={{ background: "#fffbeb" }}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800 flex-1">Fiches manquantes — période de rattrapage</p>
          <div className="flex items-center gap-2">
            <Select value={rattrapageMois} onValueChange={setRattrapageMois}>
              <SelectTrigger className="h-8 text-xs w-32 bg-white border-amber-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{MOIS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={rattrapageAnnee} onValueChange={setRattrapageAnnee}>
              <SelectTrigger className="h-8 text-xs w-24 bg-white border-amber-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {employesSansFiche.length === 0 ? (
          <p className="text-xs text-emerald-700 font-medium">
            ✓ Tous les employés actifs ont une fiche pour {MOIS[rMois - 1]} {rAnnee}.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {employesSansFiche.map(e => (
                <button key={e.id}
                  onClick={() => {
                    setEditId(null)
                    setForm({ employeId: e.id, mois: rattrapageMois, annee: rattrapageAnnee, salaireBase: String(e.salaireBase), primes: "0", retenues: "0", notes: "", heuresSupplementaires: "0", tauxHS: "NORMAL", joursAbsence: "0", minutesRetardTotal: "0" })
                    setShowForm(true)
                    setActiveTab("fiches")
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="text-xs px-2.5 py-1 rounded-full font-medium border transition-colors hover:border-amber-400"
                  style={{ background: "white", borderColor: "#fde68a", color: "#92400e" }}>
                  {e.prenom} {e.nom}
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              {employesSansFiche.length} employé(s) sans fiche pour {MOIS[rMois - 1]} {rAnnee} — cliquez sur un nom pour pré-remplir.
            </p>
          </>
        )}
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
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-6">
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
            <div className="space-y-1.5 col-span-full">
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
              <Label className="text-xs font-medium text-slate-600">Retenues manuelles</Label>
              <Input type="number" value={form.retenues} onChange={e => setForm(p => ({ ...p, retenues: e.target.value }))} min="0" step="1000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Heures supplémentaires</Label>
              <Input type="number" value={form.heuresSupplementaires} onChange={e => setForm(p => ({ ...p, heuresSupplementaires: e.target.value }))} min="0" step="0.5" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Taux HS</Label>
              <Select value={form.tauxHS} onValueChange={v => setForm(p => ({ ...p, tauxHS: v as TauxHS }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">+20% — Normal (≤8h/sem.)</SelectItem>
                  <SelectItem value="ELEVE">+50% — Élevé (&gt;8h/sem.)</SelectItem>
                  <SelectItem value="DIMANCHE">+75% — Dimanche/Férié</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Absences & retards ── */}
            <div className="col-span-full">
              <div className="rounded-lg border border-red-100 bg-red-50/40 p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <p className="col-span-full text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Déductions — absences & retards</p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Jours d'absence</Label>
                  <Input
                    type="number"
                    value={form.joursAbsence}
                    onChange={e => setForm(p => ({ ...p, joursAbsence: e.target.value }))}
                    min="0" max="26" step="1" placeholder="0"
                  />
                  {previewRetenueAbsence > 0 && (
                    <p className="text-xs text-red-600 font-medium">
                      Retenue : – {previewRetenueAbsence.toLocaleString("fr-FR")} FCFA
                      <span className="text-slate-400 font-normal ml-1">
                        ({parseInt(form.joursAbsence || "0")}j × {Math.round(previewBase / 26).toLocaleString("fr-FR")} FCFA/jour)
                      </span>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Retard cumulé (minutes)</Label>
                  <Input
                    type="number"
                    value={form.minutesRetardTotal}
                    onChange={e => setForm(p => ({ ...p, minutesRetardTotal: e.target.value }))}
                    min="0" step="1" placeholder="0"
                  />
                  {previewRetenueRetard > 0 && (
                    <p className="text-xs text-red-600 font-medium">
                      Retenue : – {previewRetenueRetard.toLocaleString("fr-FR")} FCFA
                      <span className="text-slate-400 font-normal ml-1">
                        ({parseInt(form.minutesRetardTotal || "0")} min)
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
            {avancesEnAttentePourEmploye.length > 0 && (
              <div className="col-span-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs">
                <p className="font-semibold text-amber-800 mb-1">Avances à déduire automatiquement</p>
                {avancesEnAttentePourEmploye.map(a => (
                  <p key={a.id} className="text-amber-700">— {a.montant.toLocaleString("fr-FR")} FCFA {a.motif ? `(${a.motif})` : ""}</p>
                ))}
                <p className="text-amber-600 mt-1 font-medium">Total : {avancesEnAttentePourEmploye.reduce((s, a) => s + a.montant, 0).toLocaleString("fr-FR")} FCFA</p>
              </div>
            )}
            <div className="space-y-1.5 col-span-full">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observations..." />
            </div>
            {previewCalc && (
              <div className="col-span-full rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs space-y-1">
                <p className="font-semibold text-blue-800 mb-2 text-sm">Simulation — Droit camerounais (CNPS · IRPP · CAC · RAV)</p>
                {([
                  { label: "Salaire brut imposable", val: previewCalc.brutImposable, cls: "text-slate-800 font-medium" },
                  ...(previewHS > 0 ? [{ label: `Heures sup. (${form.heuresSupplementaires}h × taux ${form.tauxHS})`, val: previewHS, cls: "text-emerald-700" }] : []),
                  { label: `CNPS salarié 4.2% (plaf. ${CAMEROUN.CNPS_PLAFOND_MENSUEL.toLocaleString("fr-FR")} FCFA)`, val: -previewCalc.cnpsSalarie, cls: "text-red-700" },
                  { label: "Revenu net imposable", val: previewCalc.revenuNetImposable, cls: "text-slate-500 italic" },
                  { label: `Abattement forfaitaire (30%, plaf. 25 000)`, val: -previewCalc.abattement, cls: "text-red-700" },
                  { label: "IRPP (progressif)", val: -previewCalc.irpp, cls: "text-red-700" },
                  { label: "CAC (10% de l'IRPP)", val: -previewCalc.cac, cls: "text-red-700" },
                  { label: "RAV (forfait mensuel)", val: -previewCalc.rav, cls: "text-red-700" },
                  ...(previewRetenueAbsence > 0 ? [{ label: `Absences (${form.joursAbsence}j × base/26)`, val: -previewRetenueAbsence, cls: "text-red-700" }] : []),
                  ...(previewRetenueRetard > 0 ? [{ label: `Retards (${form.minutesRetardTotal} min)`, val: -previewRetenueRetard, cls: "text-red-700" }] : []),
                  ...((parseFloat(form.retenues || "0") || 0) > 0 ? [{ label: "Autres retenues", val: -(parseFloat(form.retenues || "0") || 0), cls: "text-red-700" }] : []),
                ] as { label: string; val: number; cls: string }[]).map(r => (
                  <div key={r.label} className={`flex justify-between ${r.cls}`}>
                    <span>{r.label}</span>
                    <span className="tabular-nums font-medium">{r.val < 0 ? `– ${Math.abs(r.val).toLocaleString("fr-FR")}` : r.val.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                ))}
                <div className="border-t border-blue-300 pt-1.5 mt-1 flex justify-between text-blue-900 font-bold text-sm">
                  <span>NET À PAYER</span>
                  <span className="tabular-nums">{formatFCFA(previewCalc.netAPayer)}</span>
                </div>
                <div className="border-t border-blue-100 pt-1 mt-1 text-slate-500 space-y-0.5">
                  <div className="flex justify-between"><span>Charges patronales CNPS (13.2%)</span><span className="tabular-nums">{previewCalc.cnpsPatronal.toLocaleString("fr-FR")} FCFA</span></div>
                  <div className="flex justify-between text-slate-700 font-medium"><span>Coût total employeur</span><span className="tabular-nums">{previewCalc.coutTotal.toLocaleString("fr-FR")} FCFA</span></div>
                </div>
              </div>
            )}
            <div className="col-span-full flex justify-end gap-3">
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

      {/* Onglets */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: "fiches",   label: `Fiches de paie (${salaires.length})` },
          { key: "avances",  label: `Avances (${avances.filter(a => a.statut !== "DEDUITE").length})` },
          { key: "retenues", label: `Retenues`, badge: retenues.filter(r => r.statut === "EN_ATTENTE").length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.key ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
            {"badge" in tab && tab.badge > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-black">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Onglet Avances ── */}
      {activeTab === "avances" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-slate-900 text-sm">Avances sur salaire</span>
            </div>
            <span className="text-xs text-slate-400">{avances.filter(a => a.statut === "VALIDEE").length} validée(s) à déduire</span>
          </div>
          {avances.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucune avance enregistrée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Employé", "Montant", "Date", "Motif", "Statut", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {avances.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{a.employe.prenom} {a.employe.nom}</p>
                        <p className="text-xs text-slate-400">{a.employe.poste}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 tabular-nums">{a.montant.toLocaleString("fr-FR")} FCFA</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{new Date(a.date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{a.motif || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          a.statut === "VALIDEE" ? "bg-blue-100 text-blue-700" :
                          a.statut === "DEDUITE" ? "bg-green-100 text-green-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {a.statut === "EN_ATTENTE" ? "En attente" : a.statut === "VALIDEE" ? "Validée" : "Déduite"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {a.statut === "EN_ATTENTE" && (
                            <button onClick={() => validerAvance(a.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border"
                              style={{ borderColor: "#bfdbfe", color: "#1d4ed8", background: "#eff6ff" }}>
                              <Check className="h-3 w-3" /> Valider
                            </button>
                          )}
                          {a.statut !== "DEDUITE" && (
                            <button onClick={() => supprimerAvance(a.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Retenues ── */}
      {activeTab === "retenues" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-slate-900 text-sm">Retenues absences &amp; retards</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> En attente : {retenues.filter(r => r.statut === "EN_ATTENTE").length}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Validées : {retenues.filter(r => r.statut === "VALIDEE").length}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 inline-block" /> Annulées : {retenues.filter(r => r.statut === "ANNULEE").length}</span>
              </div>
            </div>

            {retenues.length === 0 ? (
              <div className="text-center py-14 text-slate-400">
                <Check className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucune retenue enregistrée</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {retenues.map(r => {
                  const dateLabel = new Date(r.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })
                  const isPending = r.statut === "EN_ATTENTE"
                  return (
                    <div key={r.id} className={`px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${isPending ? "bg-amber-50/40" : ""}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Badge type */}
                        <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center ${r.type === "ABSENCE" ? "bg-red-100" : "bg-orange-100"}`}>
                          <AlertCircle className={`h-4 w-4 ${r.type === "ABSENCE" ? "text-red-500" : "text-orange-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-slate-900">{r.employe.prenom} {r.employe.nom}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.type === "ABSENCE" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                              {r.type === "ABSENCE" ? "Absence" : "Retard"}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              r.statut === "EN_ATTENTE" ? "bg-amber-100 text-amber-700" :
                              r.statut === "VALIDEE"    ? "bg-emerald-100 text-emerald-700" :
                              "bg-slate-100 text-slate-500"
                            }`}>
                              {r.statut === "EN_ATTENTE" ? "En attente" : r.statut === "VALIDEE" ? "Validée" : "Annulée"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 capitalize">{dateLabel} · {r.employe.poste}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-base font-black text-red-600">−{r.montant.toLocaleString("fr-FR")} FCFA</p>
                          <p className="text-[10px] text-slate-400">retenue</p>
                        </div>
                        {isPending && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => traiterRetenue(r.id, "VALIDER")}
                              disabled={retenueValidating === r.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                              {retenueValidating === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Confirmer
                            </button>
                            <button onClick={() => traiterRetenue(r.id, "ANNULER")}
                              disabled={retenueValidating === r.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors">
                              {retenueValidating === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              Annuler
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {retenues.filter(r => r.statut === "EN_ATTENTE").length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{retenues.filter(r => r.statut === "EN_ATTENTE").length} retenue(s) en attente</span> de votre validation.
                Les retenues validées seront intégrées dans le champ &ldquo;Retenues&rdquo; lors de la génération du prochain bulletin de salaire.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "fiches" && <>
      {/* Filtres */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
        <div className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500 font-medium sm:w-auto">
          <Filter className="h-3.5 w-3.5" />
          Filtrer :
        </div>
        <Select value={filtreAnnee} onValueChange={setFiltreAnnee}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-28"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Toutes</SelectItem>
            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreMois} onValueChange={setFiltreMois}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-32"><SelectValue placeholder="Mois" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les mois</SelectItem>
            {MOIS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreEmp} onValueChange={setFiltreEmp}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-44"><SelectValue placeholder="Employé" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous les employés</SelectItem>
            {employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="h-9 text-xs w-full sm:w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
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
          <>
            {/* ── Vue mobile : cartes ── */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map(s => {
                const brut = s.brutImposable ?? (s.salaireBase + s.primes)
                return (
                  <div key={s.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                          {initiales(s.employe)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{s.employe.prenom} {s.employe.nom}</p>
                          <p className="text-xs text-slate-400">{MOIS[s.mois - 1]} {s.annee}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-black text-slate-900">{formatCurrency(s.netAPayer)}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {s.statut === "PAYE" ? "Payé" : "En attente"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span>Brut : <b className="text-slate-700">{brut.toLocaleString("fr-FR")}</b></span>
                        <span className="text-amber-600">CNPS : {(s.cnpsSalarie ?? 0).toLocaleString("fr-FR")}</span>
                        <span className="text-red-500">Imp. : {((s.irpp ?? 0) + (s.cac ?? 0)).toLocaleString("fr-FR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      {s.statut === "EN_ATTENTE" && (
                        <button onClick={() => marquerPaye(s.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border"
                          style={{ borderColor: "#bbf7d0", color: "#059669", background: "#f0fdf4" }}>
                          <Check className="h-3 w-3" /> Payé
                        </button>
                      )}
                      <button onClick={() => openBulletin(s)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600">
                        <Printer className="h-3 w-3" /> Imprimer
                      </button>
                      <button onClick={() => startEdit(s)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => supprimerSalaire(s.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Vue desktop : tableau ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      { label: "Employé", right: false },
                      { label: "Période", right: false },
                      { label: "Brut", right: true },
                      { label: "CNPS sal.", right: true },
                      { label: "IRPP+CAC", right: true },
                      { label: "Net à payer", right: true },
                      { label: "Statut", right: false },
                      { label: "", right: false },
                    ].map(h => (
                      <th key={h.label} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${h.right ? "text-right" : "text-left"}`}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(s => {
                    const brut = s.brutImposable ?? (s.salaireBase + s.primes)
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4">
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
                        <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">{MOIS[s.mois - 1]} {s.annee}</td>
                        <td className="px-4 py-4 text-sm text-right text-slate-600 tabular-nums">{brut.toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-4 text-sm text-right tabular-nums" style={{ color: "#f59e0b" }}>{(s.cnpsSalarie ?? 0).toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-4 text-sm text-right tabular-nums" style={{ color: "#ef4444" }}>{((s.irpp ?? 0) + (s.cac ?? 0)).toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-base font-black text-slate-900">{formatCurrency(s.netAPayer)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {s.statut === "PAYE" ? "Payé" : "En attente"}
                          </span>
                          {s.datePaiement && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(s.datePaiement).toLocaleDateString("fr-FR")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            {s.statut === "EN_ATTENTE" && (
                              <button onClick={() => marquerPaye(s.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                                style={{ borderColor: "#bbf7d0", color: "#059669", background: "#f0fdf4" }}>
                                <Check className="h-3 w-3" /> Payé
                              </button>
                            )}
                            <button onClick={() => openBulletin(s)}
                              title="Télécharger le bulletin PDF"
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <Printer className="h-3.5 w-3.5" />
                            </button>
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
          </>
        )}
      </div>
      </> }
    </div>
  )
}
