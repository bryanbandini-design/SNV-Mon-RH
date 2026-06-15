"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  Clock, Plus, Shuffle, Settings, ClipboardList, Loader2,
  AlertCircle, Trash2, CalendarDays, ChevronLeft, ChevronRight, Download,
} from "lucide-react"
import { minutesEnHeure } from "@/lib/utils"

type Employe     = { id: string; prenom: string; nom: string; poste: string; matricule: string }
type Shift       = { id: string; nom: string; heureDebut: string; heureFin: string; couleur: string; description: string | null }
type Affectation = { id: string; dateDebut: string; dateFin: string; employe: { prenom: string; nom: string; poste: string }; shift: Shift }
type AffCal      = { id: string; employeId: string; shiftId: string; dateDebut: string; dateFin: string; employe: { id: string; prenom: string; nom: string; poste: string }; shift: Shift }
type PresCal     = { id: string; date: string; statut: string; employe: { id: string; prenom: string; nom: string; matricule: string } }
type Presence    = {
  id: string; date: string; heureArrivee: string | null; heureDepart: string | null
  heuresTravaillees: number | null; minutesRetard: number; statut: string; notes: string | null
  employe: { prenom: string; nom: string; matricule: string; poste: string }
}

const STATUTS_PRESENCE = [
  { value: "PRESENT",  label: "Présent",  color: "#10b981", bg: "#ecfdf5" },
  { value: "ABSENT",   label: "Absent",   color: "#ef4444", bg: "#fef2f2" },
  { value: "RETARD",   label: "Retard",   color: "#f59e0b", bg: "#fffbeb" },
  { value: "CONGE",    label: "Congé",    color: "#8b5cf6", bg: "#f5f3ff" },
  { value: "JOUR_OFF", label: "Jour off", color: "#64748b", bg: "#f8fafc" },
] as const

const PRES_COLOR: Record<string, string> = {
  PRESENT: "#10b981", RETARD: "#f59e0b", ABSENT: "#ef4444",
  CONGE: "#8b5cf6", JOUR_OFF: "#64748b",
}

const COULEURS   = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]
const JOURS      = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const TABS = [
  { id: "registre",   label: "Registre",         icon: ClipboardList },
  { id: "calendrier", label: "Calendrier",        icon: CalendarDays  },
  { id: "planning",   label: "Planning shifts",   icon: Shuffle       },
  { id: "shifts",     label: "Configurer shifts", icon: Settings      },
] as const

function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const mon   = new Date(today)
  mon.setHours(0, 0, 0, 0)
  mon.setDate(today.getDate() + diff + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function empForShiftDay(aff: AffCal[], shiftId: string, day: Date): AffCal[] {
  const d = day.toISOString().split("T")[0]
  return aff.filter(a => {
    if (a.shift.id !== shiftId) return false
    return d >= a.dateDebut.split("T")[0] && d <= a.dateFin.split("T")[0]
  })
}

function presencePour(pres: PresCal[], employeId: string, day: Date): PresCal | undefined {
  const d = day.toISOString().split("T")[0]
  return pres.find(p => p.employe.id === employeId && p.date?.split("T")[0] === d)
}

export default function HorairesPage() {
  const [onglet, setOnglet] = useState<"registre" | "calendrier" | "planning" | "shifts">("registre")

  const [employes, setEmployes]         = useState<Employe[]>([])
  const [shifts, setShifts]             = useState<Shift[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [presences, setPresences]       = useState<Presence[]>([])
  const [dateSelectionnee, setDateSelectionnee] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading]           = useState(false)
  const [randomLoading, setRandomLoading] = useState(false)
  const [showPresenceForm, setShowPresenceForm] = useState(false)
  const [showShiftForm, setShowShiftForm]       = useState(false)

  // ── Calendrier state ─────────────────────────────────────────────────────────
  const [semaineOffset, setSemaineOffset] = useState(0)
  const [calData, setCalData] = useState<{ affectations: AffCal[]; presences: PresCal[] } | null>(null)
  const [calLoading, setCalLoading] = useState(false)

  const weekDays = useMemo(() => getWeekDates(semaineOffset), [semaineOffset])

  const [formPresence, setFormPresence] = useState({
    employeId: "", heureArrivee: "", heureDepart: "",
    statut: "PRESENT", heureReferenceDebut: "", notes: "",
  })
  const [formShift, setFormShift] = useState({ nom: "", heureDebut: "", heureFin: "", couleur: "#3b82f6", description: "" })
  const [planningRandom, setPlanningRandom] = useState({ dateDebut: "", dateFin: "" })
  // ── Affectation manuelle ──────────────────────────────────────────────────────
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualLoading, setManualLoading]   = useState(false)
  const [formManuel, setFormManuel] = useState({ employeId: "", shiftId: "", dateDebut: "", dateFin: "" })

  useEffect(() => {
    Promise.all([
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
      fetch("/api/shifts").then(r => r.ok ? r.json() : []),
    ]).then(([e, s]) => {
      if (Array.isArray(e)) setEmployes(e)
      if (Array.isArray(s)) setShifts(s)
    })
  }, [])

  useEffect(() => {
    fetch(`/api/presences?date=${dateSelectionnee}`).then(r => r.json()).then(setPresences)
  }, [dateSelectionnee])

  useEffect(() => {
    if (onglet !== "calendrier") return
    const days = getWeekDates(semaineOffset)
    const from = days[0].toISOString().split("T")[0]
    const to   = days[6].toISOString().split("T")[0]
    setCalLoading(true)
    setCalData(null)
    fetch(`/api/affectations?from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCalData(d) })
      .finally(() => setCalLoading(false))
  }, [onglet, semaineOffset])

  const employesSansPresence = employes.filter(e => !presences.some(p => p.employe.matricule === e.matricule))
  const heuresTotales = presences.reduce((a, p) => a + (p.heuresTravaillees ?? 0), 0)
  const nbPresents    = presences.filter(p => p.statut === "PRESENT").length
  const nbRetards     = presences.filter(p => p.statut === "RETARD").length
  const nbAbsents     = presences.filter(p => p.statut === "ABSENT").length

  async function ajouterPresence(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/presences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formPresence, date: dateSelectionnee }),
    })
    if (res.ok) {
      const p   = await res.json()
      const emp = employes.find(x => x.id === formPresence.employeId)
      setPresences(prev => [{ ...p, employe: emp! }, ...prev])
      setFormPresence({ employeId: "", heureArrivee: "", heureDepart: "", statut: "PRESENT", heureReferenceDebut: "", notes: "" })
      setShowPresenceForm(false)
      toast.success("Présence enregistrée")
    } else { toast.error("Erreur lors de l'enregistrement") }
    setLoading(false)
  }

  async function creerShift(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formShift),
    })
    if (res.ok) {
      const s = await res.json()
      setShifts(prev => [...prev, s])
      setShowShiftForm(false)
      setFormShift({ nom: "", heureDebut: "", heureFin: "", couleur: "#3b82f6", description: "" })
      toast.success("Shift créé")
    } else { toast.error("Erreur lors de la création") }
  }

  async function supprimerShift(id: string) {
    const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" })
    if (res.ok) {
      setShifts(prev => prev.filter(s => s.id !== id))
      toast.success("Shift supprimé")
    }
  }

  async function affectationManuelle(e: React.FormEvent) {
    e.preventDefault()
    setManualLoading(true)
    const res = await fetch("/api/affectations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formManuel),
    })
    if (res.ok) {
      toast.success("Affectation créée")
      setFormManuel({ employeId: "", shiftId: "", dateDebut: "", dateFin: "" })
      setShowManualForm(false)
      // Refresh calendrier si actif
      if (onglet === "calendrier") setSemaineOffset(o => o) // force refresh trick
    } else { toast.error("Erreur lors de la création") }
    setManualLoading(false)
  }

  async function affectationAleatoire() {
    if (!planningRandom.dateDebut || !planningRandom.dateFin) return
    setRandomLoading(true)
    const res = await fetch("/api/shifts/random", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planningRandom),
    })
    if (res.ok) {
      setAffectations(await res.json())
      toast.success("Planning généré")
    } else { toast.error("Erreur lors de la génération") }
    setRandomLoading(false)
  }

  // ── PDF planning par shift ───────────────────────────────────────────────────
  async function downloadPlanningPDF() {
    const { jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(15, 23, 42)
    doc.text("Planning des équipes", 14, 22)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Période : du ${new Date(planningRandom.dateDebut + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} au ${new Date(planningRandom.dateFin + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, 14, 31)
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, 14, 37)

    doc.setDrawColor(226, 232, 240)
    doc.line(14, 42, 196, 42)

    const rows = shifts.map(shift => {
      const membres = affectations.filter(a => a.shift.id === shift.id)
      return [
        shift.nom,
        `${shift.heureDebut} – ${shift.heureFin}`,
        membres.length.toString(),
        membres.map(a => `${a.employe.prenom} ${a.employe.nom}`).join(", ") || "—",
      ]
    })

    autoTable(doc, {
      startY: 47,
      head: [["Shift", "Horaires", "Nb", "Employés affectés"]],
      body: rows,
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
      bodyStyles:  { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 40 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: "auto" },
      },
      styles: { cellPadding: 4 },
      margin: { left: 14, right: 14 },
    })

    const totalEmployes = new Set(affectations.map(a => a.employe.prenom + a.employe.nom)).size
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? 100
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`${totalEmployes} employé(s) réparti(s) sur ${shifts.length} shift(s)`, 14, finalY + 8)

    doc.save(`planning-equipes-${planningRandom.dateDebut}-${planningRandom.dateFin}.pdf`)
    toast.success("Planning téléchargé")
  }

  // ── PDF calendrier hebdomadaire ───────────────────────────────────────────────
  async function downloadCalendrierPDF() {
    if (!calData || calData.affectations.length === 0) {
      toast.error("Aucune affectation à exporter pour cette semaine")
      return
    }
    const { jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const days = getWeekDates(semaineOffset)

    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(15, 23, 42)
    doc.text("Planning hebdomadaire", 14, 18)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Semaine : ${weekLabel}`, 14, 26)
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, 14, 32)

    doc.setDrawColor(226, 232, 240)
    doc.line(14, 36, 283, 36)

    const headers = [
      "Shift",
      ...days.map((d, i) => `${JOURS[i]} ${d.getDate()}/${d.getMonth() + 1}`),
    ]

    const rows = shifts.map(shift => {
      const row: string[] = [`${shift.nom}\n${shift.heureDebut}–${shift.heureFin}`]
      days.forEach(day => {
        const members = empForShiftDay(calData.affectations, shift.id, day)
        row.push(members.map(a => `${a.employe.prenom} ${a.employe.nom[0]}.`).join("\n") || "—")
      })
      return row
    })

    autoTable(doc, {
      startY: 41,
      head: [headers],
      body: rows,
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center" },
      bodyStyles:  { fontSize: 8, textColor: [30, 41, 59], halign: "center", valign: "middle" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 32 } },
      styles: { cellPadding: 3, overflow: "linebreak" },
      margin: { left: 14, right: 14 },
    })

    const from = days[0].toISOString().split("T")[0]
    const to   = days[6].toISOString().split("T")[0]
    doc.save(`calendrier-hebdo-${from}-${to}.pdf`)
    toast.success("Calendrier téléchargé")
  }

  // ── Calendrier helpers ────────────────────────────────────────────────────────
  const weekLabel = (() => {
    const d0 = weekDays[0], d6 = weekDays[6]
    const sameMonth = d0.getMonth() === d6.getMonth()
    const d0s = d0.toLocaleDateString("fr-FR", { day: "numeric", month: sameMonth ? undefined : "long" })
    const d6s = d6.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    return `${d0s} – ${d6s}`
  })()

  const todayStr = new Date().toISOString().split("T")[0]

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Horaires &amp; Présences</h1>
        <p className="text-sm text-slate-500 mt-1">Registre numérique des pointages et visualisation des équipes</p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-fit flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id as typeof onglet)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              onglet === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET REGISTRE
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "registre" && (
        <div className="space-y-5">

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 shrink-0">Date</Label>
              <Input type="date" value={dateSelectionnee} onChange={e => setDateSelectionnee(e.target.value)} className="w-44 h-9" />
            </div>
            <div className="ml-auto flex items-center gap-4">
              {[
                { label: "Présents",     value: nbPresents,                     color: "#10b981" },
                { label: "Retards",      value: nbRetards,                      color: "#f59e0b" },
                { label: "Absents",      value: nbAbsents,                      color: "#ef4444" },
                { label: "Total heures", value: `${heuresTotales.toFixed(1)}h`, color: "#3b82f6" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPresenceForm(!showPresenceForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Plus className="h-4 w-4" />
              Saisir une présence
            </button>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${showPresenceForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5">
              <form onSubmit={ajouterPresence} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Employé *</Label>
                  <Select value={formPresence.employeId} onValueChange={v => setFormPresence(p => ({ ...p, employeId: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {employes.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.prenom} {e.nom}{!employesSansPresence.find(x => x.id === e.id) ? " ✓" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Statut *</Label>
                  <Select value={formPresence.statut} onValueChange={v => setFormPresence(p => ({ ...p, statut: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUTS_PRESENCE.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Heure réf. arrivée</Label>
                  <Input type="time" value={formPresence.heureReferenceDebut} onChange={e => setFormPresence(p => ({ ...p, heureReferenceDebut: e.target.value }))} className="h-9" />
                </div>
                {(formPresence.statut === "PRESENT" || formPresence.statut === "RETARD") && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Arrivée</Label>
                      <Input type="time" value={formPresence.heureArrivee} onChange={e => setFormPresence(p => ({ ...p, heureArrivee: e.target.value }))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Départ</Label>
                      <Input type="time" value={formPresence.heureDepart} onChange={e => setFormPresence(p => ({ ...p, heureDepart: e.target.value }))} className="h-9" />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Note</Label>
                  <Input value={formPresence.notes} onChange={e => setFormPresence(p => ({ ...p, notes: e.target.value }))} placeholder="Observation…" className="h-9" />
                </div>
                <div className="col-span-3 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowPresenceForm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
                  <button type="submit" disabled={loading || !formPresence.employeId}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#6366f1" }}>
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>

          {employesSansPresence.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">{employesSansPresence.length} employé(s) sans pointage ce jour</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {employesSansPresence.map(e => (
                    <span key={e.id} className="text-xs bg-white border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5">
                      {e.prenom} {e.nom}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">
                Pointages du {new Date(dateSelectionnee + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            {presences.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucun pointage pour cette date</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Employé", "Arrivée", "Départ", "Durée", "Retard", "Statut"].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {presences.map(p => {
                    const st = STATUTS_PRESENCE.find(x => x.value === p.statut) ?? STATUTS_PRESENCE[0]
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                              {p.employe.prenom[0]}{p.employe.nom[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{p.employe.prenom} {p.employe.nom}</p>
                              <p className="text-xs text-slate-400">{p.employe.poste}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono text-slate-700">{p.heureArrivee ?? "—"}</td>
                        <td className="px-6 py-3.5 text-sm font-mono text-slate-700">{p.heureDepart ?? "—"}</td>
                        <td className="px-6 py-3.5 text-sm text-slate-700">{p.heuresTravaillees != null ? `${p.heuresTravaillees.toFixed(1)}h` : "—"}</td>
                        <td className="px-6 py-3.5 text-sm">
                          {p.minutesRetard > 0
                            ? <span className="font-semibold text-red-500">+{minutesEnHeure(p.minutesRetard)}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET CALENDRIER
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "calendrier" && (
        <div className="space-y-4">

          {/* Navigation semaine */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setSemaineOffset(o => o - 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-slate-900 text-sm min-w-[220px] text-center">
                {weekLabel}
              </span>
              <button onClick={() => setSemaineOffset(o => o + 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSemaineOffset(0)}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 transition-colors">
                Aujourd&apos;hui
              </button>
              <button onClick={downloadCalendrierPDF}
                disabled={!calData || calData.affectations.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="h-3.5 w-3.5" />
                Télécharger PDF
              </button>
            </div>
          </div>

          {/* Légende shifts */}
          {shifts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {shifts.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border"
                  style={{ background: s.couleur + "18", color: s.couleur, borderColor: s.couleur + "35" }}>
                  <span className="h-2 w-2 rounded-full inline-block" style={{ background: s.couleur }} />
                  {s.nom} · {s.heureDebut}–{s.heureFin}
                </span>
              ))}
            </div>
          )}

          {/* Alerte aucune affectation */}
          {!calLoading && calData && calData.affectations.length === 0 && shifts.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Aucune affectation pour cette semaine</p>
                <p className="text-xs text-amber-600 mt-0.5">Générez un planning dans l&apos;onglet &ldquo;Planning shifts&rdquo; pour affecter les employés aux shifts.</p>
              </div>
            </div>
          )}

          {/* Grille calendrier */}
          {calLoading ? (
            <div className="flex items-center justify-center py-16 rounded-xl border border-slate-200 bg-white">
              <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
            </div>
          ) : shifts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-14">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium text-sm">Aucun shift configuré</p>
              <p className="text-xs text-slate-400 mt-1">Créez des shifts dans l&apos;onglet &ldquo;Configurer shifts&rdquo;</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[780px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-36 border-r border-slate-100">
                      Shift
                    </th>
                    {weekDays.map((day, i) => {
                      const ds = day.toISOString().split("T")[0]
                      const isToday = ds === todayStr
                      return (
                        <th key={i} className={`px-2 py-3 text-center text-xs ${isToday ? "text-indigo-600" : "text-slate-500"}`}>
                          <p className="font-semibold uppercase tracking-wide text-[10px]">{JOURS[i]}</p>
                          <p className={`text-lg font-black leading-tight mt-0.5 ${isToday ? "text-indigo-600" : "text-slate-800"}`}>
                            {day.getDate()}
                          </p>
                          <p className="text-[10px] text-slate-400 font-normal">
                            {day.toLocaleDateString("fr-FR", { month: "short" })}
                          </p>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift, si) => (
                    <tr key={shift.id} className={`${si % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-slate-50 transition-colors`}>

                      {/* Shift label */}
                      <td className="px-4 py-3 border-r border-slate-100 align-top">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: shift.couleur }} />
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight">{shift.nom}</p>
                            <p className="text-[10px] text-slate-400 font-mono leading-tight mt-0.5">{shift.heureDebut}–{shift.heureFin}</p>
                          </div>
                        </div>
                      </td>

                      {/* Day cells */}
                      {weekDays.map((day, di) => {
                        const ds = day.toISOString().split("T")[0]
                        const isToday = ds === todayStr
                        const members = calData ? empForShiftDay(calData.affectations, shift.id, day) : []
                        return (
                          <td key={di}
                            className={`px-2 py-2.5 text-center align-top border-l border-slate-100/70 ${isToday ? "bg-indigo-50/30" : ""}`}>
                            {members.length === 0 ? (
                              <span className="text-slate-200 text-xs select-none">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {members.map(a => {
                                  const pres = calData ? presencePour(calData.presences, a.employe.id, day) : undefined
                                  const dotColor = pres ? (PRES_COLOR[pres.statut] ?? "#94a3b8") : "#cbd5e1"
                                  const presLabel = pres ? (STATUTS_PRESENCE.find(s => s.value === pres.statut)?.label ?? pres.statut) : "Non saisi"
                                  return (
                                    <div key={a.id} className="relative group/emp cursor-default"
                                      title={`${a.employe.prenom} ${a.employe.nom} — ${a.employe.poste} (${presLabel})`}>
                                      {/* Avatar */}
                                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold select-none"
                                        style={{
                                          background: shift.couleur,
                                          outline: `2px solid ${dotColor}`,
                                          outlineOffset: "1px",
                                        }}>
                                        {a.employe.prenom[0]}{a.employe.nom[0]}
                                      </div>
                                      {/* Presence dot */}
                                      <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-white"
                                        style={{ backgroundColor: dotColor }} />
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-slate-800 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/emp:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                        {a.employe.prenom} {a.employe.nom}
                                        <br />
                                        <span style={{ color: dotColor }}>{presLabel}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          )}

          {/* Légende statuts présence */}
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="font-semibold text-slate-700">Statut de présence :</span>
            {[
              { color: "#10b981", label: "Présent"  },
              { color: "#f59e0b", label: "Retard"   },
              { color: "#ef4444", label: "Absent"   },
              { color: "#8b5cf6", label: "Congé"    },
              { color: "#cbd5e1", label: "Non saisi" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET PLANNING SHIFTS
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "planning" && (
        <div className="space-y-5">
          {shifts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-14">
              <Settings className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium">Aucun shift configuré</p>
              <p className="text-sm text-slate-400 mt-1">Allez d&apos;abord dans &ldquo;Configurer shifts&rdquo;</p>
            </div>
          ) : (
            <>
              {/* Affectation manuelle */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900 text-sm">Affectation manuelle</h2>
                      <p className="text-xs text-slate-400">Affecter un employé précis à un shift sur une période</p>
                    </div>
                  </div>
                  <button onClick={() => setShowManualForm(!showManualForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    Nouvelle affectation
                  </button>
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${showManualForm ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <form onSubmit={affectationManuelle} className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Employé *</Label>
                      <Select value={formManuel.employeId} onValueChange={v => setFormManuel(p => ({ ...p, employeId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Choisir un employé" /></SelectTrigger>
                        <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Shift *</Label>
                      <Select value={formManuel.shiftId} onValueChange={v => setFormManuel(p => ({ ...p, shiftId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Choisir un shift" /></SelectTrigger>
                        <SelectContent>{shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.nom} · {s.heureDebut}–{s.heureFin}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Du *</Label>
                      <Input type="date" value={formManuel.dateDebut} onChange={e => setFormManuel(p => ({ ...p, dateDebut: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Au *</Label>
                      <Input type="date" value={formManuel.dateFin} min={formManuel.dateDebut} onChange={e => setFormManuel(p => ({ ...p, dateFin: e.target.value }))} required />
                    </div>
                    <div className="col-span-2 flex justify-end gap-3">
                      <button type="button" onClick={() => setShowManualForm(false)}
                        className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
                      <button type="submit"
                        disabled={manualLoading || !formManuel.employeId || !formManuel.shiftId || !formManuel.dateDebut || !formManuel.dateFin}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: "#3b82f6" }}>
                        {manualLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Affecter
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Affectation aléatoire */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Shuffle className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Affectation aléatoire du personnel</h2>
                    <p className="text-xs text-slate-400">Répartit automatiquement tous les employés entre {shifts.length} shift(s)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Du *</Label>
                    <Input type="date" value={planningRandom.dateDebut} onChange={e => setPlanningRandom(p => ({ ...p, dateDebut: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Au *</Label>
                    <Input type="date" value={planningRandom.dateFin} onChange={e => setPlanningRandom(p => ({ ...p, dateFin: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={affectationAleatoire}
                    disabled={randomLoading || !planningRandom.dateDebut || !planningRandom.dateFin}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
                    {randomLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                    Générer l&apos;affectation
                  </button>
                  <span className="text-xs text-slate-400">{employes.length} employés · {shifts.length} shifts · Répartition équilibrée</span>
                </div>
              </div>

              {affectations.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="font-semibold text-slate-900 text-sm">Résultat de l&apos;affectation</p>
                    <button onClick={downloadPlanningPDF}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                      <Download className="h-3.5 w-3.5" />
                      Télécharger PDF
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {shifts.map(shift => {
                      const membres = affectations.filter(a => a.shift.id === shift.id)
                      return (
                        <div key={shift.id} className="px-6 py-4">
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: shift.couleur }} />
                            <p className="font-semibold text-slate-900 text-sm">{shift.nom}</p>
                            <span className="text-xs text-slate-400">{shift.heureDebut} → {shift.heureFin}</span>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{membres.length} personne(s)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {membres.map(a => (
                              <span key={a.id} className="text-xs border text-slate-600 rounded-full px-2.5 py-1"
                                style={{ borderColor: shift.couleur + "40", background: shift.couleur + "10" }}>
                                {a.employe.prenom} {a.employe.nom}
                              </span>
                            ))}
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET CONFIGURER SHIFTS
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "shifts" && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={() => setShowShiftForm(!showShiftForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Plus className="h-4 w-4" />
              Nouveau shift
            </button>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${showShiftForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5">
              <h2 className="font-semibold text-slate-900 text-sm mb-4">Créer un shift</h2>
              <form onSubmit={creerShift} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Nom du shift *</Label>
                  <Input placeholder="ex: Shift A, Équipe Matin" value={formShift.nom} onChange={e => setFormShift(p => ({ ...p, nom: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Description</Label>
                  <Input placeholder="Optionnel" value={formShift.description} onChange={e => setFormShift(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Heure de début *</Label>
                  <Input type="time" value={formShift.heureDebut} onChange={e => setFormShift(p => ({ ...p, heureDebut: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Heure de fin *</Label>
                  <Input type="time" value={formShift.heureFin} onChange={e => setFormShift(p => ({ ...p, heureFin: e.target.value }))} required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-medium text-slate-600">Couleur</Label>
                  <div className="flex gap-2">
                    {COULEURS.map(c => (
                      <button key={c} type="button" onClick={() => setFormShift(p => ({ ...p, couleur: c }))}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${formShift.couleur === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowShiftForm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#6366f1" }}>Créer le shift</button>
                </div>
              </form>
            </div>
          </div>

          {shifts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-12">
              <Clock className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium text-sm">Aucun shift configuré</p>
              <p className="text-xs text-slate-400 mt-1">Créez vos shifts (ex: Shift A 6h–14h, Shift B 14h–22h)</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {shifts.map(s => {
                const [hd, md] = s.heureDebut ? s.heureDebut.split(":").map(Number) : [0, 0]
                const [hf, mf] = s.heureFin   ? s.heureFin.split(":").map(Number)   : [0, 0]
                const duree = ((hf * 60 + mf) - (hd * 60 + md)) / 60
                return (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: s.couleur }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{s.nom}</p>
                          {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                          <div className="flex items-center gap-2 mt-3">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-mono text-slate-700">{s.heureDebut} → {s.heureFin}</span>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{duree.toFixed(1)}h</span>
                          </div>
                        </div>
                        <button onClick={() => supprimerShift(s.id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
