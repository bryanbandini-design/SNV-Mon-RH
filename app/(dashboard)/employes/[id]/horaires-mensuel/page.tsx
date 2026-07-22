"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Printer, Star, Clock, UserCheck, TrendingUp,
  AlertTriangle, CheckCircle, Calendar, Timer, Download,
  ChevronLeft, ChevronRight, Loader2, FileText,
} from "lucide-react"
import { MOIS } from "@/lib/utils"

// ── Types ───────────────────────────────────────────────────────────────────
type Employe = {
  id: string; prenom: string; nom: string; matricule: string; poste: string
  departement: string | null; statut: string; salaireBase: number
}

type PresenceDetail = {
  id: string; date: string; statut: string
  heureArrivee: string | null; heureDepart: string | null
  heuresTravaillees: number | null; minutesRetard: number
  heuresSupBrutes: number; statutHeuresSup: string
  saisieManuelle: boolean; notes: string | null
}

type Stats = {
  mois: number; annee: number
  joursOuvres: number; joursConge: number; joursAttendu: number
  nbPresent: number; nbRetard: number; nbAbsent: number
  nbConge: number; nbJourOff: number; nbSaisies: number
  nbPresentsTotal: number; tauxPresence: number
  totalMinRetard: number; totalHeures: number
  totalHSValidees: number; totalHSEnAttente: number
  scorePonctualite: number
  presences: PresenceDetail[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUT_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PRESENT:  { label: "Présent",   color: "#059669", bg: "#ecfdf5", dot: "#10b981" },
  RETARD:   { label: "Retard",    color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  ABSENT:   { label: "Absent",    color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
  CONGE:    { label: "Congé",     color: "#7c3aed", bg: "#f5f3ff", dot: "#8b5cf6" },
  JOUR_OFF: { label: "Jour off",  color: "#64748b", bg: "#f8fafc", dot: "#94a3b8" },
  ABSENT_ND:{ label: "Abs. (non saisi)", color: "#991b1b", bg: "#fef2f2", dot: "#ef4444" },
}

const HS_CFG: Record<string, { label: string; color: string }> = {
  EN_ATTENTE: { label: "HS à valider", color: "#d97706" },
  VALIDEE:    { label: "HS validées",  color: "#059669" },
  REJETEE:    { label: "HS rejetées",  color: "#dc2626" },
}

function hm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}` : `${m}min`
}

function scoreLabel(s: number): string {
  return ["", "Insuffisant", "À améliorer", "Satisfaisant", "Bien", "Excellent"][s] ?? ""
}

function scoreColor(s: number): string {
  return s <= 1 ? "#dc2626" : s === 2 ? "#f97316" : s === 3 ? "#f59e0b" : s === 4 ? "#3b82f6" : "#10b981"
}

// Construit le calendrier du mois avec les saisies correspondantes
function buildCalendar(mois: number, annee: number, presences: PresenceDetail[]) {
  const presMap = new Map(presences.map(p => [p.date.slice(0, 10), p]))
  const firstDay = new Date(annee, mois - 1, 1)
  const daysInMonth = new Date(annee, mois, 0).getDate()
  // Décalage pour commencer un lundi (0=dim→6, 1=lun→0, …)
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells: (null | { date: string; presence: PresenceDetail | null; isWeekend: boolean })[] = []

  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dt    = new Date(annee, mois - 1, d)
    const dow   = dt.getDay()
    const key   = `${annee}-${String(mois).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    cells.push({
      date:      key,
      presence:  presMap.get(key) ?? null,
      isWeekend: dow === 0 || dow === 6,
    })
  }
  return cells
}

// ── Composant principal ─────────────────────────────────────────────────────
export default function HorairesMensuelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const now  = new Date()
  const [mois,  setMois]  = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)

  // Chargement employé
  useEffect(() => {
    fetch(`/api/employes/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setEmploye)
  }, [id])

  // Chargement stats mensuel
  const loadStats = useCallback(() => {
    setLoading(true)
    fetch(`/api/employes/${id}/stats-horaires?mois=${mois}&annee=${annee}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id, mois, annee])

  useEffect(() => { loadStats() }, [loadStats])

  function prevMois() {
    if (mois === 1) { setMois(12); setAnnee(a => a - 1) }
    else setMois(m => m - 1)
  }
  function nextMois() {
    if (mois === 12) { setMois(1); setAnnee(a => a + 1) }
    else setMois(m => m + 1)
  }

  // ── PDF ──────────────────────────────────────────────────────────────────
  async function genererPDF() {
    if (!employe || !stats) return
    setPrinting(true)
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const W = 210, M = 14

    // Couleurs
    const NAVY   = [26, 52, 97] as const
    const ACCENT = [37, 99, 235] as const
    const GREEN  = [5, 150, 105] as const
    const AMBER  = [217, 119, 6] as const
    const RED    = [220, 38, 38] as const
    const SLATE  = [100, 116, 139] as const

    function hex2rgb(hex: string): [number, number, number] {
      const n = parseInt(hex.replace("#", ""), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }

    // ── Header ──
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 40, "F")
    doc.setFillColor(122, 179, 46)
    doc.rect(0, 0, 4, 40, "F")

    doc.setTextColor(122, 179, 46)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.text("SANOVIA HEALTH CARE", M, 10)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.text("Rapport Horaire Mensuel", M, 20)

    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(147, 197, 253)
    doc.text(`${employe.prenom} ${employe.nom} — ${MOIS[mois - 1]} ${annee}`, M, 28)
    doc.text(`Matricule : ${employe.matricule} | Poste : ${employe.poste}`, M, 34)

    // Date d'impression
    doc.setTextColor(147, 197, 253)
    doc.setFontSize(7)
    doc.text(`Imprimé le ${new Date().toLocaleDateString("fr-FR")}`, W - M, 10, { align: "right" })

    // ── Score ponctualité ──
    const sc = stats.scorePonctualite
    const scCol = hex2rgb(scoreColor(sc))
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(M, 46, W - 2 * M, 22, 3, 3, "F")
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(M, 46, W - 2 * M, 22, 3, 3, "S")

    doc.setTextColor(...NAVY)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text("Score Ponctualité & Assiduité", M + 4, 54)

    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...scCol)
    doc.text(`${sc}/5`, M + 4, 63)

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...scCol)
    doc.text(scoreLabel(sc), M + 22, 63)

    // Étoiles
    const starX = W - M - 35
    for (let i = 1; i <= 5; i++) {
      doc.setFillColor(i <= sc ? 250 : 226, i <= sc ? 204 : 232, i <= sc ? 21 : 240)
      doc.circle(starX + (i - 1) * 7, 57, 2.5, "F")
      doc.setFontSize(6)
      doc.setTextColor(i <= sc ? 92 : 148, i <= sc ? 64 : 163, i <= sc ? 0 : 184)
      doc.text("★", starX + (i - 1) * 7 - 1.5, 58.2)
    }

    // ── KPI cards ──
    let y = 74
    const kpis = [
      { label: "Jours attendus",    val: stats.joursAttendu.toString(),         col: ACCENT },
      { label: "Jours présents",    val: stats.nbPresentsTotal.toString(),       col: GREEN  },
      { label: "Absences",          val: stats.nbAbsent.toString(),             col: stats.nbAbsent > 0 ? RED : GREEN },
      { label: "Retards",           val: stats.nbRetard.toString(),             col: stats.nbRetard > 0 ? AMBER : GREEN },
      { label: "Taux présence",     val: `${stats.tauxPresence}%`,              col: stats.tauxPresence >= 90 ? GREEN : RED },
      { label: "Cumul retards",     val: stats.totalMinRetard > 0 ? hm(stats.totalMinRetard) : "0", col: AMBER },
      { label: "Heures travaillées",val: `${stats.totalHeures.toFixed(1)}h`,    col: ACCENT },
      { label: "HS validées",       val: `${stats.totalHSValidees.toFixed(1)}h`, col: GREEN },
    ]

    const kW = (W - 2 * M - 6 * 4) / 4
    kpis.forEach((k, i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const kx  = M + col * (kW + 4)
      const ky  = y + row * 20
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(kx, ky, kW, 16, 2, 2, "F")
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(kx, ky, kW, 16, 2, 2, "S")
      doc.setFillColor(k.col[0], k.col[1], k.col[2])
      doc.roundedRect(kx, ky, 2, 16, 1, 1, "F")
      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(k.col[0], k.col[1], k.col[2])
      doc.text(k.val, kx + kW / 2, ky + 8, { align: "center" })
      doc.setFontSize(6)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...SLATE)
      doc.text(k.label.toUpperCase(), kx + kW / 2, ky + 13, { align: "center" })
    })
    y += 44

    // ── Tableau détaillé ──
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...NAVY)
    doc.text("Détail journalier", M, y)
    y += 5

    // Header tableau
    const cols = [
      { label: "Date",        w: 30 },
      { label: "Statut",      w: 24 },
      { label: "Arrivée",     w: 18 },
      { label: "Départ",      w: 18 },
      { label: "Heures",      w: 18 },
      { label: "Retard",      w: 18 },
      { label: "HS",          w: 18 },
      { label: "Remarque",    w: 0  }, // remaining
    ]
    const remW = W - 2 * M - cols.slice(0, -1).reduce((s, c) => s + c.w, 0)
    cols[cols.length - 1].w = remW

    doc.setFillColor(...NAVY)
    doc.rect(M, y, W - 2 * M, 6, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(6.5)
    doc.setFont("helvetica", "bold")
    let cx = M + 1
    cols.forEach(c => {
      doc.text(c.label, cx, y + 4)
      cx += c.w
    })
    y += 6

    // Lignes
    const allDays = buildCalendar(mois, annee, stats.presences)
    const workDays = allDays.filter(c => c && !c.isWeekend) as { date: string; presence: PresenceDetail | null; isWeekend: boolean }[]
    let row = 0
    for (const day of workDays) {
      if (y > 270) {
        doc.addPage()
        y = 14
      }
      const bg = row % 2 === 0 ? [255, 255, 255] : [248, 250, 252]
      doc.setFillColor(...(bg as [number, number, number]))
      doc.rect(M, y, W - 2 * M, 5.5, "F")

      const p = day.presence
      const statut = p ? p.statut : "ABSENT_ND"
      const scfg = STATUT_CFG[statut]
      const scol = hex2rgb(scfg?.color ?? "#64748b")

      doc.setFontSize(6.5)
      doc.setFont("helvetica", "normal")
      let rx = M + 1

      // Date
      const d   = new Date(day.date + "T12:00:00")
      const dn  = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })
      doc.setTextColor(15, 23, 42)
      doc.text(dn, rx, y + 3.8)
      rx += cols[0].w

      // Statut
      doc.setFillColor(...hex2rgb(scfg?.bg ?? "#f8fafc"))
      doc.roundedRect(rx, y + 0.5, 20, 4, 1, 1, "F")
      doc.setTextColor(...scol)
      doc.setFont("helvetica", "bold")
      doc.text(scfg?.label ?? statut, rx + 1, y + 3.8)
      rx += cols[1].w

      doc.setFont("helvetica", "normal")
      doc.setTextColor(15, 23, 42)
      // Arrivée
      doc.text(p?.heureArrivee ?? "—", rx, y + 3.8)
      rx += cols[2].w
      // Départ
      doc.text(p?.heureDepart ?? "—", rx, y + 3.8)
      rx += cols[3].w
      // Heures
      doc.text(p?.heuresTravaillees != null ? `${p.heuresTravaillees.toFixed(1)}h` : "—", rx, y + 3.8)
      rx += cols[4].w
      // Retard
      if ((p?.minutesRetard ?? 0) > 0) {
        doc.setTextColor(...AMBER)
        doc.text(hm(p!.minutesRetard), rx, y + 3.8)
        doc.setTextColor(15, 23, 42)
      } else {
        doc.text("—", rx, y + 3.8)
      }
      rx += cols[5].w
      // HS
      if ((p?.heuresSupBrutes ?? 0) > 0) {
        const hscol = hex2rgb(HS_CFG[p!.statutHeuresSup]?.color ?? "#64748b")
        doc.setTextColor(...hscol)
        doc.text(`+${p!.heuresSupBrutes.toFixed(1)}h`, rx, y + 3.8)
        doc.setTextColor(15, 23, 42)
      } else {
        doc.text("—", rx, y + 3.8)
      }
      rx += cols[6].w
      // Notes
      if (p?.notes) {
        doc.setTextColor(...SLATE)
        doc.setFontSize(5.5)
        doc.text(p.notes.slice(0, 40), rx, y + 3.8)
      }
      if (p?.saisieManuelle) {
        doc.setFontSize(5)
        doc.setTextColor(...SLATE)
        doc.text("[M]", rx + remW - 6, y + 3.8)
      }

      doc.setDrawColor(226, 232, 240)
      doc.line(M, y + 5.5, W - M, y + 5.5)
      y += 5.5
      row++
    }

    // ── Pied de page ──
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFillColor(...NAVY)
      doc.rect(0, 285, W, 12, "F")
      doc.setFontSize(6.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(147, 197, 253)
      doc.text("SANOVIA Health Care — Document confidentiel", M, 291)
      doc.text(`Page ${i}/${pageCount}`, W - M, 291, { align: "right" })
    }

    doc.save(`Rapport_Horaire_${employe.nom}_${MOIS[mois - 1]}_${annee}.pdf`)
    setPrinting(false)
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  if (!employe) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
    </div>
  )

  const cells = stats ? buildCalendar(mois, annee, stats.presences) : []
  const presMap = stats ? new Map(stats.presences.map(p => [p.date.slice(0, 10), p])) : new Map()

  const sc = stats?.scorePonctualite ?? 0
  const scCol = scoreColor(sc)

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {employe.prenom} {employe.nom} — Rapport horaire mensuel
            </h1>
            <p className="text-sm text-slate-500">{employe.poste} {employe.departement ? `· ${employe.departement}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/evaluations?employeId=${id}&prefillPonctualite=${sc}&mois=${mois}&annee=${annee}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors">
            <FileText className="h-4 w-4" /> Utiliser pour évaluation
          </Link>
          <button onClick={genererPDF} disabled={printing || !stats}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger PDF
          </button>
        </div>
      </div>

      {/* Sélecteur mois */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3 w-fit">
        <button onClick={prevMois} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold text-slate-900 min-w-36 text-center text-sm">
          {MOIS[mois - 1]} {annee}
        </span>
        <button onClick={nextMois} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : !stats ? (
        <div className="text-center py-16 text-slate-400">Aucune donnée disponible.</div>
      ) : (
        <>
          {/* Score ponctualité */}
          <div className="rounded-2xl border p-5 flex flex-wrap items-center gap-6"
            style={{ borderColor: scCol + "40", background: scCol + "08" }}>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Score Ponctualité & Assiduité</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black" style={{ color: scCol }}>{sc}</span>
                <span className="text-lg font-semibold text-slate-400">/5</span>
                <span className="text-base font-bold ml-1" style={{ color: scCol }}>{scoreLabel(sc)}</span>
              </div>
              <div className="flex gap-1 mt-2">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="h-5 w-5"
                    style={{ fill: i <= sc ? "#fbbf24" : "#e2e8f0", color: i <= sc ? "#f59e0b" : "#e2e8f0" }} />
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Score calculé automatiquement en fonction du taux de présence, du nombre et de la durée des retards, et des heures supplémentaires validées.
              Peut être utilisé pour pré-remplir le critère Ponctualité dans l&apos;évaluation.
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Calendar,      label: "Jours attendus",   val: stats.joursAttendu,                  unit: "j",  color: "#3b82f6" },
              { icon: UserCheck,     label: "Jours présents",   val: stats.nbPresentsTotal,               unit: "j",  color: "#10b981" },
              { icon: AlertTriangle, label: "Absences",         val: stats.nbAbsent,                      unit: "j",  color: stats.nbAbsent   > 0 ? "#ef4444" : "#10b981" },
              { icon: Clock,         label: "Retards",          val: stats.nbRetard,                      unit: "",   color: stats.nbRetard   > 0 ? "#f59e0b" : "#10b981" },
              { icon: TrendingUp,    label: "Taux présence",    val: `${stats.tauxPresence}`,             unit: "%",  color: stats.tauxPresence >= 90 ? "#10b981" : "#ef4444" },
              { icon: Timer,         label: "Cumul retards",    val: stats.totalMinRetard > 0 ? hm(stats.totalMinRetard) : "0", unit: "", color: "#f59e0b" },
              { icon: Clock,         label: "Heures travaillées",val: stats.totalHeures.toFixed(1),       unit: "h",  color: "#6366f1" },
              { icon: CheckCircle,   label: "HS validées",      val: stats.totalHSValidees.toFixed(1),   unit: "h",  color: "#10b981" },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className="h-4 w-4 flex-shrink-0" style={{ color: k.color }} />
                  <p className="text-xs font-medium text-slate-500 truncate">{k.label}</p>
                </div>
                <p className="text-2xl font-black" style={{ color: k.color }}>
                  {k.val}<span className="text-sm font-semibold ml-0.5">{k.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Calendrier visuel */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900 text-sm">Vue calendrier — {MOIS[mois - 1]} {annee}</h2>
            </div>
            <div className="p-4">
              {/* Jours de semaine */}
              <div className="grid grid-cols-7 mb-1">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(j => (
                  <div key={j} className="text-center text-[10px] font-semibold text-slate-400 py-1">{j}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, idx) => {
                  if (!cell) return <div key={idx} />

                  const p = cell.presence
                  // Weekend sans saisie → case grise neutre
                  if (cell.isWeekend && !p) return (
                    <div key={idx} className="rounded-lg p-1.5 bg-slate-50 min-h-14 border border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-300 text-center">
                        {parseInt(cell.date.slice(8))}
                      </p>
                    </div>
                  )

                  // Jour ouvré ou weekend avec saisie → carte colorée
                  const statut = p ? p.statut : "ABSENT_ND"
                  const cfg = STATUT_CFG[statut]
                  return (
                    <div key={idx}
                      className="rounded-lg p-1.5 min-h-14 flex flex-col"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.dot}25` }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold" style={{ color: cfg.color }}>
                          {parseInt(cell.date.slice(8))}
                        </p>
                        {cell.isWeekend && (
                          <span className="text-[7px] font-bold text-slate-400 bg-slate-200 px-1 rounded">WE</span>
                        )}
                      </div>
                      <div className="flex justify-center mb-0.5">
                        <span className="text-[8px] font-semibold px-1 py-0.5 rounded" style={{ background: cfg.dot + "20", color: cfg.color }}>
                          {cfg.label.slice(0, 6)}
                        </span>
                      </div>
                      {p?.heureArrivee && (
                        <p className="text-[9px] text-center font-mono" style={{ color: cfg.color }}>
                          {p.heureArrivee}
                        </p>
                      )}
                      {(p?.minutesRetard ?? 0) > 0 && (
                        <p className="text-[8px] text-center text-amber-600 font-semibold">
                          +{hm(p!.minutesRetard)}
                        </p>
                      )}
                      {(p?.heuresSupBrutes ?? 0) > 0 && (
                        <p className="text-[8px] text-center font-semibold" style={{ color: HS_CFG[p!.statutHeuresSup]?.color ?? "#64748b" }}>
                          HS +{p!.heuresSupBrutes.toFixed(1)}h
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Tableau journalier */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Détail journalier</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Date", "Statut", "Arrivée", "Départ", "Heures", "Retard", "HS", "Type", "Notes"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(cells.filter(c => c && (!c.isWeekend || c.presence !== null)) as { date: string; presence: PresenceDetail | null; isWeekend: boolean }[])
                    .map(({ date, presence: p, isWeekend }) => {
                      const statut = p ? p.statut : "ABSENT_ND"
                      const cfg = STATUT_CFG[statut]
                      return (
                        <tr key={date} className={`hover:bg-slate-50/50 ${isWeekend ? "bg-slate-50/40" : ""}`}>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                              </span>
                              {isWeekend && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">WE</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: cfg.bg, color: cfg.color }}>
                              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{p?.heureArrivee ?? "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{p?.heureDepart  ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-indigo-700">
                            {p?.heuresTravaillees != null ? `${p.heuresTravaillees.toFixed(1)}h` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {(p?.minutesRetard ?? 0) > 0
                              ? <span className="font-semibold text-amber-600">{hm(p!.minutesRetard)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {(p?.heuresSupBrutes ?? 0) > 0
                              ? <span className="font-semibold" style={{ color: HS_CFG[p!.statutHeuresSup]?.color }}>
                                  +{p!.heuresSupBrutes.toFixed(1)}h
                                  {p!.statutHeuresSup === "VALIDEE" && " ✓"}
                                  {p!.statutHeuresSup === "EN_ATTENTE" && " ⏳"}
                                  {p!.statutHeuresSup === "REJETEE" && " ✗"}
                                </span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {p?.saisieManuelle
                              ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">Manuel</span>
                              : p
                              ? <span className="text-[10px] text-slate-400">Auto</span>
                              : null}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400 max-w-32 truncate">{p?.notes ?? ""}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
