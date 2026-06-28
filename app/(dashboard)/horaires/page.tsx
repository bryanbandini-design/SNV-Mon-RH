"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  Clock, Plus, Shuffle, Settings, ClipboardList, Loader2,
  AlertCircle, Trash2, CalendarDays, ChevronLeft, ChevronRight, Download,
  Pencil, Check, X, Users, UserCheck, Crown, Info, PenLine, ShieldCheck,
  ShieldX, Zap,
} from "lucide-react"
import { minutesEnHeure } from "@/lib/utils"
import { useSession } from "next-auth/react"

type Employe     = { id: string; prenom: string; nom: string; poste: string; matricule: string; userRole?: string | null }
type Shift       = { id: string; nom: string; heureDebut: string; heureFin: string; couleur: string; description: string | null }
type AffResult   = { id: string; dateDebut: string; dateFin: string; employe: { prenom: string; nom: string; poste: string; utilisateur?: { role: string } | null }; shift: Shift }
type AffCal      = { id: string; employeId: string; shiftId: string; dateDebut: string; dateFin: string; employe: { id: string; prenom: string; nom: string; poste: string }; shift: Shift }
type PresCal     = { id: string; date: string; statut: string; employe: { id: string; prenom: string; nom: string; matricule: string } }
type Presence    = {
  id: string; date: string; heureArrivee: string | null; heureDepart: string | null
  heuresTravaillees: number | null; minutesRetard: number; statut: string; notes: string | null
  saisieManuelle: boolean; statutValidation: string; saisieParNom: string | null; motifManuel: string | null
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

const COULEURS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]
const JOURS    = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const TABS = [
  { id: "registre",   label: "Registre",          icon: ClipboardList },
  { id: "manuel",     label: "Saisie manuelle",   icon: PenLine       },
  { id: "calendrier", label: "Calendrier",         icon: CalendarDays  },
  { id: "equipes",    label: "Composition équipes", icon: Users         },
  { id: "shifts",     label: "Gérer les shifts",   icon: Settings      },
] as const

const MOTIFS_MANUEL = [
  "Rattrapage de données",
  "Panne de courant",
  "Panne système pointage",
  "Terminal QR hors service",
  "Oubli de badge",
  "Correction d'erreur",
  "Autre",
]

const VALID_CFG = {
  EN_ATTENTE: { label: "En attente de validation", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  VALIDEE:    { label: "Validée",                  color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
  REJETEE:    { label: "Rejetée",                  color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
}

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

function isResponsable(role?: string | null) {
  return role === "RESPONSABLE" || role === "ADMIN"
}

function RoleBadge({ role }: { role?: string | null }) {
  if (!role || role === "EMPLOYE") return null
  if (isResponsable(role)) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Crown className="h-2.5 w-2.5" /> Resp.
      </span>
    )
  }
  if (role === "RH") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">RH</span>
  }
  return null
}

// ── Durée d'un shift ────────────────────────────────────────────────────────
function dureeShift(s: Shift) {
  const [hd, md] = s.heureDebut.split(":").map(Number)
  const [hf, mf] = s.heureFin.split(":").map(Number)
  let min = (hf * 60 + mf) - (hd * 60 + md)
  if (min < 0) min += 24 * 60 // shift de nuit
  return (min / 60).toFixed(1)
}

export default function HorairesPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session?.user as any)?.role as string | undefined
  const userName = session?.user?.name ?? "Utilisateur"
  const isAdmin  = userRole === "ADMIN"

  const [onglet, setOnglet] = useState<"registre" | "manuel" | "calendrier" | "equipes" | "shifts">("registre")

  const [employes,      setEmployes]      = useState<Employe[]>([])
  const [shifts,        setShifts]        = useState<Shift[]>([])
  const [presences,     setPresences]     = useState<Presence[]>([])
  const [dateSelectionnee, setDateSelectionnee] = useState(new Date().toISOString().split("T")[0])
  const [loading,       setLoading]       = useState(false)

  // ── Calendrier ──────────────────────────────────────────────────────────────
  const [semaineOffset, setSemaineOffset] = useState(0)
  const [calData,       setCalData]       = useState<{ affectations: AffCal[]; presences: PresCal[] } | null>(null)
  const [calLoading,    setCalLoading]    = useState(false)
  const weekDays = useMemo(() => getWeekDates(semaineOffset), [semaineOffset])

  // ── Registre ────────────────────────────────────────────────────────────────
  const [showPresenceForm, setShowPresenceForm] = useState(false)
  const [formPresence, setFormPresence] = useState({
    employeId: "", heureArrivee: "", heureDepart: "",
    statut: "PRESENT", heureReferenceDebut: "", notes: "",
  })

  // ── Shifts — édition inline ──────────────────────────────────────────────────
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [formShift,   setFormShift]   = useState({ nom: "", heureDebut: "", heureFin: "", couleur: "#3b82f6", description: "" })
  const [editForm,    setEditForm]    = useState({ nom: "", heureDebut: "", heureFin: "", couleur: "#3b82f6", description: "" })
  const [savingShift, setSavingShift] = useState(false)

  // ── Saisie manuelle ─────────────────────────────────────────────────────────
  const [saisiesManuelle, setSaisiesManuelle] = useState<Presence[]>([])
  const [saisiesMLoading, setSaisiesMLoading] = useState(false)
  const [validating, setValidating] = useState<string | null>(null)
  const [formManuel, setFormManuel] = useState({
    employeId: "", date: new Date().toISOString().split("T")[0],
    heureArrivee: "", heureDepart: "", motifManuel: "Rattrapage de données", notes: "",
  })
  const [savingManuel, setSavingManuel] = useState(false)

  // ── Composition équipes ──────────────────────────────────────────────────────
  const [equipesPeriode, setEquipesPeriode] = useState({ dateDebut: "", dateFin: "" })
  const [equipesData,    setEquipesData]    = useState<AffCal[] | null>(null)
  const [equipesLoading, setEquipesLoading] = useState(false)
  const [randomLoading,  setRandomLoading]  = useState(false)
  const [randomResult,   setRandomResult]   = useState<AffResult[] | null>(null)
  const [addingToShift,  setAddingToShift]  = useState<string | null>(null) // shiftId
  const [addEmpId,       setAddEmpId]       = useState("")
  const [addingEmp,      setAddingEmp]      = useState(false)
  const [removingId,     setRemovingId]     = useState<string | null>(null)

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
    if (onglet !== "manuel") return
    setSaisiesMLoading(true)
    fetch("/api/presences?manuel=all")
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setSaisiesManuelle(d) })
      .finally(() => setSaisiesMLoading(false))
  }, [onglet])

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

  // ── Calendrier helpers ───────────────────────────────────────────────────────
  const weekLabel = (() => {
    const d0 = weekDays[0], d6 = weekDays[6]
    const sameMonth = d0.getMonth() === d6.getMonth()
    const d0s = d0.toLocaleDateString("fr-FR", { day: "numeric", month: sameMonth ? undefined : "long" })
    const d6s = d6.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    return `${d0s} – ${d6s}`
  })()
  const todayStr = new Date().toISOString().split("T")[0]

  // ── Registre — ajouter présence ─────────────────────────────────────────────
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

  // ── Saisie manuelle — soumettre ─────────────────────────────────────────────
  async function soumettreManuel(e: React.FormEvent) {
    e.preventDefault()
    if (!formManuel.employeId || !formManuel.date || !formManuel.heureArrivee || !formManuel.heureDepart) {
      toast.error("Veuillez renseigner l'employé, la date et les heures")
      return
    }
    setSavingManuel(true)
    const res = await fetch("/api/presences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formManuel,
        saisieManuelle: true,
        saisieParNom: userName,
      }),
    })
    if (res.ok) {
      const p = await res.json()
      const emp = employes.find(x => x.id === formManuel.employeId)
      setSaisiesManuelle(prev => [{ ...p, employe: emp! }, ...prev])
      setFormManuel({ employeId: "", date: new Date().toISOString().split("T")[0], heureArrivee: "", heureDepart: "", motifManuel: "Rattrapage de données", notes: "" })
      toast.success("Saisie soumise — en attente de validation administrateur")
    } else { toast.error("Erreur lors de la soumission") }
    setSavingManuel(false)
  }

  // ── Saisie manuelle — valider/rejeter ────────────────────────────────────────
  async function validerSaisie(id: string, action: "VALIDER" | "REJETER") {
    setValidating(id)
    const res = await fetch(`/api/presences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const updated = await res.json()
      setSaisiesManuelle(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
      // Si validée, l'ajouter aussi au registre du jour correspondant
      if (action === "VALIDER") toast.success("Saisie validée — présence enregistrée")
      else toast.success("Saisie rejetée")
    } else { toast.error("Erreur lors de la validation") }
    setValidating(null)
  }

  // ── Shifts — créer ──────────────────────────────────────────────────────────
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

  // ── Shifts — éditer ─────────────────────────────────────────────────────────
  function startEdit(s: Shift) {
    setEditingShiftId(s.id)
    setEditForm({ nom: s.nom, heureDebut: s.heureDebut, heureFin: s.heureFin, couleur: s.couleur, description: s.description ?? "" })
  }
  async function saveEdit(id: string) {
    setSavingShift(true)
    const res = await fetch(`/api/shifts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      const updated = await res.json()
      setShifts(prev => prev.map(s => s.id === id ? updated : s))
      setEditingShiftId(null)
      toast.success("Shift mis à jour")
    } else { toast.error("Erreur lors de la mise à jour") }
    setSavingShift(false)
  }

  // ── Shifts — supprimer ──────────────────────────────────────────────────────
  async function supprimerShift(id: string) {
    if (!confirm("Supprimer ce shift ? Les affectations liées seront aussi supprimées.")) return
    const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" })
    if (res.ok) {
      setShifts(prev => prev.filter(s => s.id !== id))
      toast.success("Shift supprimé")
    } else { toast.error("Erreur lors de la suppression") }
  }

  // ── Équipes — charger ────────────────────────────────────────────────────────
  async function chargerEquipes() {
    if (!equipesPeriode.dateDebut || !equipesPeriode.dateFin) return
    setEquipesLoading(true)
    setEquipesData(null)
    setRandomResult(null)
    const res = await fetch(`/api/affectations?from=${equipesPeriode.dateDebut}&to=${equipesPeriode.dateFin}`)
    if (res.ok) {
      const d = await res.json()
      setEquipesData(d.affectations ?? [])
    } else { toast.error("Erreur de chargement") }
    setEquipesLoading(false)
  }

  // ── Équipes — retirer un membre ──────────────────────────────────────────────
  async function retirerMembre(affId: string) {
    setRemovingId(affId)
    const res = await fetch(`/api/affectations?id=${affId}`, { method: "DELETE" })
    if (res.ok) {
      setEquipesData(prev => prev ? prev.filter(a => a.id !== affId) : prev)
      toast.success("Membre retiré")
    } else { toast.error("Erreur") }
    setRemovingId(null)
  }

  // ── Équipes — ajouter un membre ─────────────────────────────────────────────
  async function ajouterMembre(shiftId: string) {
    if (!addEmpId || !equipesPeriode.dateDebut || !equipesPeriode.dateFin) return
    setAddingEmp(true)
    const res = await fetch("/api/affectations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId: addEmpId, shiftId, dateDebut: equipesPeriode.dateDebut, dateFin: equipesPeriode.dateFin }),
    })
    if (res.ok) {
      const aff = await res.json()
      const emp = employes.find(e => e.id === addEmpId)
      const shift = shifts.find(s => s.id === shiftId)
      if (emp && shift) {
        setEquipesData(prev => [...(prev ?? []), {
          ...aff,
          employe: { id: emp.id, prenom: emp.prenom, nom: emp.nom, poste: emp.poste },
          shift,
        }])
      }
      setAddEmpId("")
      setAddingToShift(null)
      toast.success("Membre ajouté")
    } else {
      const d = await res.json()
      toast.error(d.message ?? "Erreur")
    }
    setAddingEmp(false)
  }

  // ── Équipes — affectation aléatoire ──────────────────────────────────────────
  async function affectationAleatoire() {
    if (!equipesPeriode.dateDebut || !equipesPeriode.dateFin) return
    setRandomLoading(true)
    setRandomResult(null)
    const res = await fetch("/api/shifts/random", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(equipesPeriode),
    })
    if (res.ok) {
      const d = await res.json()
      setRandomResult(d.affectations)
      // Refresh équipes data
      setEquipesData(d.affectations.map((a: AffResult) => ({
        ...a,
        employe: { id: a.id, ...a.employe },
      })))
      if (d.nbShiftsSansResp > 0) {
        toast.warning(`${d.nbShiftsSansResp} shift(s) sans responsable assigné (pas assez de responsables dans l'effectif)`)
      } else {
        toast.success("Planning généré — chaque shift a un responsable")
      }
    } else {
      const d = await res.json()
      toast.error(d.message ?? "Erreur")
    }
    setRandomLoading(false)
  }

  // ── PDF calendrier hebdo ──────────────────────────────────────────────────────
  async function downloadCalendrierPDF() {
    if (!calData || calData.affectations.length === 0) {
      toast.error("Aucune affectation à exporter pour cette semaine")
      return
    }
    const { jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")
    const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const days = getWeekDates(semaineOffset)
    const w    = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const NAVY  = [26, 52, 97]   as [number,number,number]
    const GREEN = [122, 179, 46] as [number,number,number]
    const SLATE = [51, 65, 85]   as [number,number,number]
    const GREY  = [100, 116, 139] as [number,number,number]
    const m = 14

    // Logo
    try {
      const blob = await fetch("/logo-sanovia.png").then(r => r.blob())
      const b64: string = await new Promise((res, rej) => {
        const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.onerror = rej; rd.readAsDataURL(blob)
      })
      doc.addImage(b64, "PNG", m, 7, 55, 13.4)
    } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY)
      doc.text("SANOVIA HEALTH CARE", m, 16)
    }
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(0, 26, w, 26)

    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY)
    doc.text("PLANNING HEBDOMADAIRE", m, 36)
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY)
    doc.text(`Semaine : ${weekLabel}`, m, 43)
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, m, 49)

    const headers = ["Shift", ...days.map((d, i) => `${JOURS[i]} ${d.getDate()}/${d.getMonth() + 1}`)]
    const rows = shifts.map(shift => {
      const row: string[] = [`${shift.nom}\n${shift.heureDebut}–${shift.heureFin}`]
      days.forEach(day => {
        const members = empForShiftDay(calData.affectations, shift.id, day)
        row.push(members.map(a => `${a.employe.prenom} ${a.employe.nom[0]}.`).join("\n") || "—")
      })
      return row
    })

    autoTable(doc, {
      startY: 55, head: [headers], body: rows,
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: "bold", fontSize: 9, halign: "center" },
      bodyStyles: { fontSize: 8, textColor: SLATE, halign: "center", valign: "middle" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 32 } },
      styles: { cellPadding: 3, overflow: "linebreak" },
      margin: { left: m, right: m },
    })

    // Pied de page SANOVIA
    const footH = 15
    doc.setFillColor(...NAVY); doc.rect(0, pageH - footH, w, footH, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255,255,255)
    doc.text("SANOVIA Health Care", w / 2, pageH - footH + 5, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5)
    doc.text("Tél : 656 67 67 67 — 670 44 55 68   |   shcdg@sanoviahc.com   |   NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
      w / 2, pageH - footH + 11, { align: "center" })

    const from = days[0].toISOString().split("T")[0]
    const to   = days[6].toISOString().split("T")[0]
    doc.save(`calendrier-hebdo-${from}-${to}.pdf`)
    toast.success("Calendrier téléchargé")
  }

  // ── PDF planning équipes ──────────────────────────────────────────────────────
  async function downloadEquipesPDF() {
    const data = equipesData ?? []
    if (data.length === 0) { toast.error("Aucune affectation à exporter"); return }
    const { jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")
    const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const w     = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const NAVY  = [26, 52, 97]   as [number,number,number]
    const GREEN = [122, 179, 46] as [number,number,number]
    const SLATE = [51, 65, 85]   as [number,number,number]
    const GREY  = [100, 116, 139] as [number,number,number]
    const m = 14

    // Logo
    try {
      const blob = await fetch("/logo-sanovia.png").then(r => r.blob())
      const b64: string = await new Promise((res, rej) => {
        const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.onerror = rej; rd.readAsDataURL(blob)
      })
      doc.addImage(b64, "PNG", m, 7, 55, 13.4)
    } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY)
      doc.text("SANOVIA HEALTH CARE", m, 16)
    }
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(0, 26, w, 26)

    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY)
    doc.text("COMPOSITION DES ÉQUIPES", m, 36)
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY)
    const fromLabel = new Date(equipesPeriode.dateDebut + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    const toLabel   = new Date(equipesPeriode.dateFin   + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    doc.text(`Période : du ${fromLabel} au ${toLabel}`, m, 43)
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, m, 49)

    const rows = shifts.map(shift => {
      const membres = data.filter(a => a.shiftId === shift.id)
      const noms    = membres.map(a => `${a.employe.prenom} ${a.employe.nom} (${a.employe.poste})`).join("\n") || "—"
      return [shift.nom, `${shift.heureDebut} – ${shift.heureFin}`, membres.length.toString(), noms]
    })

    autoTable(doc, {
      startY: 55,
      head: [["Shift", "Horaires", "Effectif", "Membres"]],
      body: rows,
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: "bold", fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: SLATE },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 }, 1: { cellWidth: 28, halign: "center" }, 2: { cellWidth: 18, halign: "center" } },
      styles: { cellPadding: 4, overflow: "linebreak" },
      margin: { left: m, right: m },
    })

    // Pied de page SANOVIA
    const footH = 18
    doc.setFillColor(...NAVY); doc.rect(0, pageH - footH, w, footH, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255,255,255)
    doc.text("SANOVIA Health Care", w / 2, pageH - footH + 5, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.8)
    doc.text("Tél : 656 67 67 67 — 670 44 55 68   |   shcdg@sanoviahc.com   |   Société à responsabilité limitée",
      w / 2, pageH - footH + 10, { align: "center" })
    doc.text("NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
      w / 2, pageH - footH + 15, { align: "center" })

    doc.save(`equipes-${equipesPeriode.dateDebut}-${equipesPeriode.dateFin}.pdf`)
    toast.success("Planning téléchargé")
  }

  // ── Équipes — données par shift ──────────────────────────────────────────────
  function membresParShift(shiftId: string): AffCal[] {
    return (equipesData ?? []).filter(a => a.shiftId === shiftId)
  }

  function empDisponibles(shiftId: string): Employe[] {
    const dejaDans = new Set((equipesData ?? []).filter(a => a.shiftId === shiftId).map(a => a.employe.id))
    return employes.filter(e => !dejaDans.has(e.id))
  }

  const responsablesCount = employes.filter(e => isResponsable(e.userRole)).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Horaires &amp; Présences</h1>
        <p className="text-sm text-slate-500 mt-1">Registre de présences, composition des équipes et gestion des shifts</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-fit flex-shrink-0">
        {TABS.map(t => {
          const pendingManuel = t.id === "manuel" ? saisiesManuelle.filter(s => s.statutValidation === "EN_ATTENTE").length : 0
          return (
            <button key={t.id} onClick={() => setOnglet(t.id as typeof onglet)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                onglet === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              <t.icon className="h-4 w-4" />
              {t.label}
              {pendingManuel > 0 && isAdmin && (
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-amber-500">
                  {pendingManuel}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET REGISTRE
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "registre" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 shrink-0">Date</Label>
              <Input type="date" value={dateSelectionnee} onChange={e => setDateSelectionnee(e.target.value)} className="w-44 h-9" />
            </div>
            <div className="grid grid-cols-4 gap-3 sm:ml-auto">
              {[
                { label: "Présents",     value: nbPresents,                     color: "#10b981" },
                { label: "Retards",      value: nbRetards,                      color: "#f59e0b" },
                { label: "Absents",      value: nbAbsents,                      color: "#ef4444" },
                { label: "Heures",       value: `${heuresTotales.toFixed(1)}h`, color: "#3b82f6" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPresenceForm(!showPresenceForm)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white sm:ml-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Plus className="h-4 w-4" /> Saisir une présence
            </button>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${showPresenceForm ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5">
              <form onSubmit={ajouterPresence} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Employé *</Label>
                  <Select value={formPresence.employeId} onValueChange={v => setFormPresence(p => ({ ...p, employeId: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {employes.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}{!employesSansPresence.find(x => x.id === e.id) ? " ✓" : ""}</SelectItem>
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
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowPresenceForm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
                  <button type="submit" disabled={loading || !formPresence.employeId}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#6366f1" }}>
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer
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
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
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
                    const vcfg = p.saisieManuelle ? VALID_CFG[p.statutValidation as keyof typeof VALID_CFG] ?? VALID_CFG.EN_ATTENTE : null
                    const rowBg = p.saisieManuelle && p.statutValidation === "EN_ATTENTE" ? "bg-amber-50/50" : p.saisieManuelle && p.statutValidation === "REJETEE" ? "bg-red-50/30 opacity-60" : ""
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${rowBg}`}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                              {p.employe.prenom[0]}{p.employe.nom[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-slate-900">{p.employe.prenom} {p.employe.nom}</p>
                                {p.saisieManuelle && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{ background: vcfg?.bg, color: vcfg?.color, border: `1px solid ${vcfg?.border}` }}>
                                    <PenLine className="h-2.5 w-2.5" /> Manuel
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{p.employe.poste}{p.motifManuel ? ` · ${p.motifManuel}` : ""}</p>
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
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET CALENDRIER
      ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET SAISIE MANUELLE
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "manuel" && (
        <div className="space-y-6">

          {/* Bandeau info */}
          <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <Zap className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-indigo-800">
              <p className="font-semibold">Saisie administrative — rattrapage & corrections</p>
              <p className="text-xs mt-0.5 text-indigo-700">
                Vous pouvez saisir des présences pour <strong>n&apos;importe quelle date passée</strong> (rattrapage de données, panne système, correction).
                En tant qu&apos;administrateur, les saisies sont <strong>validées automatiquement</strong> et immédiatement comptabilisées dans les heures de travail.
              </p>
            </div>
          </div>

          {/* Formulaire de saisie */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <PenLine className="h-4 w-4 text-indigo-500" />
              <p className="font-semibold text-slate-900 text-sm">Nouvelle saisie manuelle</p>
            </div>
            <form onSubmit={soumettreManuel} className="p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label className="text-xs font-medium text-slate-600">Employé *</Label>
                  <Select value={formManuel.employeId} onValueChange={v => setFormManuel(p => ({ ...p, employeId: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Date *</Label>
                  <Input type="date" value={formManuel.date} onChange={e => setFormManuel(p => ({ ...p, date: e.target.value }))} className="h-9" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Motif *</Label>
                  <Select value={formManuel.motifManuel} onValueChange={v => setFormManuel(p => ({ ...p, motifManuel: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{MOTIFS_MANUEL.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Heure d&apos;arrivée *</Label>
                  <Input type="time" value={formManuel.heureArrivee} onChange={e => setFormManuel(p => ({ ...p, heureArrivee: e.target.value }))} className="h-9" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Heure de départ *</Label>
                  <Input type="time" value={formManuel.heureDepart} onChange={e => setFormManuel(p => ({ ...p, heureDepart: e.target.value }))} className="h-9" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Observation</Label>
                  <Input value={formManuel.notes} onChange={e => setFormManuel(p => ({ ...p, notes: e.target.value }))} placeholder="Précisions…" className="h-9" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">Saisi par : <span className="font-medium text-slate-600">{userName}</span></p>
                <button type="submit" disabled={savingManuel}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                  {savingManuel ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Enregistrer la présence
                </button>
              </div>
            </form>
          </div>

          {/* Liste des saisies manuelles */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-400" />
                <p className="font-semibold text-slate-900 text-sm">Toutes les saisies manuelles</p>
                {saisiesManuelle.filter(s => s.statutValidation === "EN_ATTENTE").length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {saisiesManuelle.filter(s => s.statutValidation === "EN_ATTENTE").length} en attente
                  </span>
                )}
              </div>
              {!isAdmin && (
                <p className="text-xs text-slate-400">Seul l&apos;administrateur peut valider</p>
              )}
            </div>

            {saisiesMLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
            ) : saisiesManuelle.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <PenLine className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Aucune saisie manuelle</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {saisiesManuelle.map(s => {
                  const vcfg = VALID_CFG[s.statutValidation as keyof typeof VALID_CFG] ?? VALID_CFG.EN_ATTENTE
                  const isPending = s.statutValidation === "EN_ATTENTE"
                  return (
                    <div key={s.id} className={`px-5 py-4 ${isPending ? "bg-amber-50/30" : ""}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
                            {s.employe.prenom[0]}{s.employe.nom[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <p className="font-semibold text-slate-900 text-sm">{s.employe.prenom} {s.employe.nom}</p>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: vcfg.bg, color: vcfg.color, border: `1px solid ${vcfg.border}` }}>
                                {vcfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{s.employe.poste}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                              <span className="font-medium text-slate-700">
                                {new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                              </span>
                              <span className="font-mono">{s.heureArrivee} → {s.heureDepart}</span>
                              {s.heuresTravaillees != null && <span className="font-semibold text-indigo-600">{s.heuresTravaillees.toFixed(1)}h</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {s.motifManuel && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s.motifManuel}</span>
                              )}
                              {s.saisieParNom && (
                                <span className="text-xs text-slate-400">par {s.saisieParNom}</span>
                              )}
                              {s.notes && <span className="text-xs text-slate-400 italic">{s.notes}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Boutons validation (admin seulement, saisies en attente seulement) */}
                        {isAdmin && isPending && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => validerSaisie(s.id, "VALIDER")}
                              disabled={validating === s.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors">
                              {validating === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                              Valider
                            </button>
                            <button onClick={() => validerSaisie(s.id, "REJETER")}
                              disabled={validating === s.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 transition-colors">
                              {validating === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                              Rejeter
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET CALENDRIER
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "calendrier" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setSemaineOffset(o => o - 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-slate-900 text-sm text-center flex-1 sm:flex-none sm:min-w-[220px]">{weekLabel}</span>
              <button onClick={() => setSemaineOffset(o => o + 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSemaineOffset(0)}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100">
                Aujourd&apos;hui
              </button>
              <button onClick={downloadCalendrierPDF}
                disabled={!calData || calData.affectations.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="h-3.5 w-3.5" /> Télécharger PDF
              </button>
            </div>
          </div>

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

          {!calLoading && calData && calData.affectations.length === 0 && shifts.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Aucune affectation pour cette semaine</p>
                <p className="text-xs text-amber-600 mt-0.5">Composez vos équipes dans l&apos;onglet &ldquo;Composition équipes&rdquo;.</p>
              </div>
            </div>
          )}

          {calLoading ? (
            <div className="flex items-center justify-center py-16 rounded-xl border border-slate-200 bg-white">
              <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
            </div>
          ) : shifts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-14">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium text-sm">Aucun shift configuré</p>
              <p className="text-xs text-slate-400 mt-1">Créez des shifts dans l&apos;onglet &ldquo;Gérer les shifts&rdquo;</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[780px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-36 border-r border-slate-100">Shift</th>
                    {weekDays.map((day, i) => {
                      const ds = day.toISOString().split("T")[0]
                      const isToday = ds === todayStr
                      return (
                        <th key={i} className={`px-2 py-3 text-center text-xs ${isToday ? "text-indigo-600" : "text-slate-500"}`}>
                          <p className="font-semibold uppercase tracking-wide text-[10px]">{JOURS[i]}</p>
                          <p className={`text-lg font-black leading-tight mt-0.5 ${isToday ? "text-indigo-600" : "text-slate-800"}`}>{day.getDate()}</p>
                          <p className="text-[10px] text-slate-400 font-normal">{day.toLocaleDateString("fr-FR", { month: "short" })}</p>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift, si) => (
                    <tr key={shift.id} className={`${si % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-slate-50 transition-colors`}>
                      <td className="px-4 py-3 border-r border-slate-100 align-top">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: shift.couleur }} />
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight">{shift.nom}</p>
                            <p className="text-[10px] text-slate-400 font-mono leading-tight mt-0.5">{shift.heureDebut}–{shift.heureFin}</p>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day, di) => {
                        const ds = day.toISOString().split("T")[0]
                        const isToday = ds === todayStr
                        const members = calData ? empForShiftDay(calData.affectations, shift.id, day) : []
                        return (
                          <td key={di} className={`px-2 py-2.5 text-center align-top border-l border-slate-100/70 ${isToday ? "bg-indigo-50/30" : ""}`}>
                            {members.length === 0 ? (
                              <span className="text-slate-200 text-xs select-none">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {members.map(a => {
                                  const pres = calData ? presencePour(calData.presences, a.employe.id, day) : undefined
                                  const dotColor  = pres ? (PRES_COLOR[pres.statut] ?? "#94a3b8") : "#cbd5e1"
                                  const presLabel = pres ? (STATUTS_PRESENCE.find(s => s.value === pres.statut)?.label ?? pres.statut) : "Non saisi"
                                  return (
                                    <div key={a.id} className="relative group/emp cursor-default"
                                      title={`${a.employe.prenom} ${a.employe.nom} — ${a.employe.poste} (${presLabel})`}>
                                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold select-none"
                                        style={{ background: shift.couleur, outline: `2px solid ${dotColor}`, outlineOffset: "1px" }}>
                                        {a.employe.prenom[0]}{a.employe.nom[0]}
                                      </div>
                                      <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-white" style={{ backgroundColor: dotColor }} />
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-slate-800 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/emp:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                        {a.employe.prenom} {a.employe.nom}<br />
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

          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="font-semibold text-slate-700">Statut :</span>
            {[{ color: "#10b981", label: "Présent" }, { color: "#f59e0b", label: "Retard" }, { color: "#ef4444", label: "Absent" }, { color: "#8b5cf6", label: "Congé" }, { color: "#cbd5e1", label: "Non saisi" }]
              .map(s => <div key={s.label} className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /><span>{s.label}</span></div>)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET COMPOSITION ÉQUIPES
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "equipes" && (
        <div className="space-y-5">

          {shifts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-14">
              <Settings className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium">Aucun shift configuré</p>
              <p className="text-sm text-slate-400 mt-1">Allez d&apos;abord dans &ldquo;Gérer les shifts&rdquo;</p>
            </div>
          ) : (
            <>
              {/* Période + actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Période de planification</p>
                    <p className="text-xs text-slate-400 mt-0.5">Choisissez la plage, chargez les équipes, puis ajustez</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Du</label>
                      <input type="date" value={equipesPeriode.dateDebut} onChange={e => setEquipesPeriode(p => ({ ...p, dateDebut: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Au</label>
                      <input type="date" value={equipesPeriode.dateFin} min={equipesPeriode.dateDebut} onChange={e => setEquipesPeriode(p => ({ ...p, dateFin: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <button onClick={chargerEquipes} disabled={equipesLoading || !equipesPeriode.dateDebut || !equipesPeriode.dateFin}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50 transition-colors">
                      {equipesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                      Charger
                    </button>
                  </div>
                </div>

                {/* Affectation aléatoire */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Shuffle className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Affectation aléatoire</p>
                      <p className="text-xs text-slate-400">
                        Répartit les {employes.length} employés sur {shifts.length} shift(s) — garantit 1 responsable par shift
                        {responsablesCount < shifts.length && (
                          <span className="text-amber-600"> · ⚠ seulement {responsablesCount} responsable(s) pour {shifts.length} shift(s)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button onClick={affectationAleatoire}
                    disabled={randomLoading || !equipesPeriode.dateDebut || !equipesPeriode.dateFin}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
                    {randomLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                    Générer aléatoirement
                  </button>
                </div>
              </div>

              {/* Légende */}
              <div className="flex items-center gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><Crown className="h-2.5 w-2.5" /> Resp.</span>
                  <span className="text-slate-500">Responsable / Admin (chef d&apos;équipe)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">RH</span>
                  <span className="text-slate-500">Ressources Humaines</span>
                </div>
              </div>

              {/* Grille shifts */}
              {equipesData === null ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center py-12">
                  <Users className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-400">Choisissez une période et cliquez sur &ldquo;Charger&rdquo;</p>
                  <p className="text-xs text-slate-300 mt-1">ou utilisez &ldquo;Générer aléatoirement&rdquo; pour créer le planning</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">
                      {(equipesData ?? []).length} affectation(s) · {shifts.length} shift(s)
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={downloadEquipesPDF} disabled={(equipesData ?? []).length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40">
                        <Download className="h-3.5 w-3.5" /> Télécharger PDF
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {shifts.map(shift => {
                      const membres = membresParShift(shift.id)
                      const aResp   = membres.some(m => {
                        const emp = employes.find(e => e.id === m.employe.id)
                        return isResponsable(emp?.userRole)
                      })
                      const disponibles = empDisponibles(shift.id)

                      return (
                        <div key={shift.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                          {/* Header shift */}
                          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100"
                            style={{ borderLeftWidth: 4, borderLeftColor: shift.couleur }}>
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-slate-900 text-sm">{shift.nom}</p>
                                  {!aResp && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                      <AlertCircle className="h-2.5 w-2.5" /> Sans responsable
                                    </span>
                                  )}
                                  {aResp && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                      <UserCheck className="h-2.5 w-2.5" /> Encadré
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 font-mono">{shift.heureDebut} – {shift.heureFin} · {dureeShift(shift)}h</p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                              {membres.length}
                            </span>
                          </div>

                          {/* Membres */}
                          <div className="p-4 space-y-2">
                            {membres.length === 0 ? (
                              <p className="text-xs text-slate-400 italic text-center py-3">Aucun membre assigné</p>
                            ) : membres.map(m => {
                              const emp = employes.find(e => e.id === m.employe.id)
                              return (
                                <div key={m.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 group/member">
                                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                    style={{ background: shift.couleur }}>
                                    {m.employe.prenom[0]}{m.employe.nom[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium text-slate-900 truncate">{m.employe.prenom} {m.employe.nom}</p>
                                      <RoleBadge role={emp?.userRole} />
                                    </div>
                                    <p className="text-xs text-slate-400 truncate">{m.employe.poste}</p>
                                  </div>
                                  <button
                                    onClick={() => retirerMembre(m.id)}
                                    disabled={removingId === m.id}
                                    className="opacity-0 group-hover/member:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                                    {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              )
                            })}

                            {/* Ajouter membre */}
                            {addingToShift === shift.id ? (
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                                <select value={addEmpId} onChange={e => setAddEmpId(e.target.value)}
                                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white min-w-0">
                                  <option value="">Choisir un employé…</option>
                                  {disponibles.map(e => (
                                    <option key={e.id} value={e.id}>
                                      {e.prenom} {e.nom}{isResponsable(e.userRole) ? " 👑" : ""}
                                    </option>
                                  ))}
                                </select>
                                <button onClick={() => ajouterMembre(shift.id)}
                                  disabled={!addEmpId || addingEmp}
                                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50 flex-shrink-0">
                                  {addingEmp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                </button>
                                <button onClick={() => { setAddingToShift(null); setAddEmpId("") }}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs flex-shrink-0">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setAddingToShift(shift.id); setAddEmpId("") }}
                                disabled={disponibles.length === 0}
                                className="w-full mt-2 py-2 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                                <Plus className="h-3.5 w-3.5" />
                                {disponibles.length === 0 ? "Tous les employés assignés" : `Ajouter un membre (${disponibles.length} dispo.)`}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {shifts.some(s => !membresParShift(s.id).some(m => isResponsable(employes.find(e => e.id === m.employe.id)?.userRole))) && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800">
                        Certains shifts n&apos;ont pas de responsable. Assignez manuellement un employé avec le rôle <strong>Responsable</strong> ou <strong>Admin</strong> pour corriger cela.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET GÉRER LES SHIFTS
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === "shifts" && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={() => { setShowShiftForm(!showShiftForm); setEditingShiftId(null) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              <Plus className="h-4 w-4" /> Nouveau shift
            </button>
          </div>

          {/* Formulaire création */}
          <div className={`transition-all duration-300 overflow-hidden ${showShiftForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5">
              <h2 className="font-semibold text-slate-900 text-sm mb-4">Créer un nouveau shift</h2>
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
                <div className="space-y-1.5 col-span-full">
                  <Label className="text-xs font-medium text-slate-600">Couleur</Label>
                  <div className="flex gap-2">
                    {COULEURS.map(c => (
                      <button key={c} type="button" onClick={() => setFormShift(p => ({ ...p, couleur: c }))}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${formShift.couleur === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="col-span-full flex justify-end gap-3">
                  <button type="button" onClick={() => setShowShiftForm(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#6366f1" }}>Créer</button>
                </div>
              </form>
            </div>
          </div>

          {shifts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white text-center py-12">
              <Clock className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium text-sm">Aucun shift configuré</p>
              <p className="text-xs text-slate-400 mt-1">Créez vos shifts (ex: Shift A 6h–14h, Shift B 14h–22h, Shift C 22h–6h)</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {shifts.map(s => {
                const isEditing = editingShiftId === s.id
                return (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: isEditing ? editForm.couleur : s.couleur }} />

                    {isEditing ? (
                      /* ── Mode édition ── */
                      <div className="p-5 space-y-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modifier le shift</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-1">
                            <label className="text-xs text-slate-500">Nom *</label>
                            <Input value={editForm.nom} onChange={e => setEditForm(p => ({ ...p, nom: e.target.value }))} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Début *</label>
                            <Input type="time" value={editForm.heureDebut} onChange={e => setEditForm(p => ({ ...p, heureDebut: e.target.value }))} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Fin *</label>
                            <Input type="time" value={editForm.heureFin} onChange={e => setEditForm(p => ({ ...p, heureFin: e.target.value }))} className="h-9" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-xs text-slate-500">Description</label>
                            <Input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} className="h-9" placeholder="Optionnel" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-xs text-slate-500">Couleur</label>
                            <div className="flex gap-2">
                              {COULEURS.map(c => (
                                <button key={c} type="button" onClick={() => setEditForm(p => ({ ...p, couleur: c }))}
                                  className={`h-7 w-7 rounded-full border-2 transition-transform ${editForm.couleur === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                                  style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button onClick={() => setEditingShiftId(null)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-600 border border-slate-200 hover:bg-slate-50">
                            <X className="h-3.5 w-3.5" /> Annuler
                          </button>
                          <button onClick={() => saveEdit(s.id)} disabled={savingShift || !editForm.nom}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50">
                            {savingShift ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Mode affichage ── */
                      <div className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{s.nom}</p>
                            {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                            <div className="flex items-center gap-2 mt-3">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span className="text-sm font-mono text-slate-700">{s.heureDebut} → {s.heureFin}</span>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{dureeShift(s)}h</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => { startEdit(s); setShowShiftForm(false) }}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => supprimerShift(s.id)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
