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

  // Clé du jour J pour ne pas marquer les jours futurs comme absents
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const cells: (null | { date: string; presence: PresenceDetail | null; isWeekend: boolean; isFuture: boolean })[] = []

  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dt    = new Date(annee, mois - 1, d)
    const dow   = dt.getDay()
    const key   = `${annee}-${String(mois).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    cells.push({
      date:      key,
      presence:  presMap.get(key) ?? null,
      isWeekend: dow === 0 || dow === 6,
      isFuture:  key > todayKey,
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

    const { jsPDF }  = await import("jspdf")
    const autoTable  = (await import("jspdf-autotable")).default
    const doc        = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const W = 210, H = 297, m = 14
    const FOOT = 20  // hauteur pied de page

    // Palette SANOVIA (identique aux autres documents)
    const NAVY  : [number,number,number] = [26,  52,  97]
    const GREEN : [number,number,number] = [122, 179,  46]
    const BLUE  : [number,number,number] = [30,  139, 192]
    const SLATE : [number,number,number] = [71,   85, 105]
    const GREY  : [number,number,number] = [100, 116, 139]
    const AMBER : [number,number,number] = [217, 119,   6]
    const RED   : [number,number,number] = [220,  38,  38]
    const LGREEN: [number,number,number] = [5,   150, 105]

    const sc = stats.scorePonctualite
    const scRgb: [number,number,number] = sc >= 5 ? GREEN : sc >= 4 ? BLUE : sc >= 3 ? AMBER : RED

    // ── Chargement logo ──────────────────────────────────────────────────────
    let logoB64: string | null = null
    try {
      const blob = await fetch("/logo-sanovia.png").then(r => r.blob())
      logoB64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = rej
        r.readAsDataURL(blob)
      })
    } catch { /* logo indisponible */ }

    // ── Helper pied de page (appliqué sur toutes les pages à la fin) ─────────
    function drawFooter(pageNum: number, total: number) {
      doc.setFillColor(...NAVY)
      doc.rect(0, H - FOOT, W, FOOT, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
      doc.text("SANOVIA Health Care", W / 2, H - FOOT + 6, { align: "center" })
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(147, 197, 253)
      doc.text(
        "Tél : 656 67 67 67 — 670 44 55 68   |   shcdg@sanoviahc.com   |   Société à responsabilité limitée",
        W / 2, H - FOOT + 11, { align: "center" }
      )
      doc.text(
        "NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
        W / 2, H - FOOT + 15.5, { align: "center" }
      )
      doc.setFontSize(7); doc.setTextColor(200, 220, 255)
      doc.text(`Page ${pageNum} / ${total}`, W - m, H - FOOT + 11, { align: "right" })
    }

    // ── En-tête page 1 ───────────────────────────────────────────────────────
    if (logoB64) {
      doc.addImage(logoB64, "PNG", m, 7, 55, 13.4)
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY)
      doc.text("SANOVIA HEALTH CARE", m, 16)
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY)
    doc.text(`Imprimé le ${new Date().toLocaleDateString("fr-FR")}`, W - m, 10, { align: "right" })
    doc.text("Document confidentiel", W - m, 15, { align: "right" })

    // Ligne verte séparatrice (identique aux autres docs)
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(0, 26, W, 26)

    // ── Bloc titre ───────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY)
    doc.text("RAPPORT HORAIRE MENSUEL", m, 34)

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY)
    doc.text(`${employe.prenom} ${employe.nom}  —  ${MOIS[mois - 1]} ${annee}`, m, 41)

    doc.setFontSize(8)
    const infoLine = `Matricule : ${employe.matricule}  ·  Poste : ${employe.poste}${employe.departement ? `  ·  ${employe.departement}` : ""}`
    doc.text(infoLine, m, 47)

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(m, 51, W - m, 51)

    // ── Score ponctualité ────────────────────────────────────────────────────
    const SCORE_TOP = 54, SCORE_H = 20
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3)
    doc.roundedRect(m, SCORE_TOP, W - 2 * m, SCORE_H, 3, 3, "FD")
    doc.setFillColor(...scRgb); doc.roundedRect(m, SCORE_TOP, 3, SCORE_H, 1, 1, "F")

    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...GREY)
    doc.text("SCORE PONCTUALITÉ & ASSIDUITÉ", m + 7, SCORE_TOP + 6)

    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...scRgb)
    doc.text(`${sc}`, m + 7, SCORE_TOP + 16)
    doc.setFontSize(11); doc.setTextColor(...GREY); doc.text("/5", m + 16, SCORE_TOP + 16)
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...scRgb)
    doc.text(scoreLabel(sc), m + 23, SCORE_TOP + 16)

    // Étoiles vectorielles (polygones 5 branches — évite le problème d'encodage WinAnsi du ★ Unicode)
    function drawStar(cx: number, cy: number, outerR: number, filled: boolean) {
      const pts: number[][] = []
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5
        const r = i % 2 === 0 ? outerR : outerR * 0.42
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)])
      }
      const segs: number[][] = []
      for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]])
      doc.setFillColor(filled ? 251 : 209, filled ? 191 : 213, filled ? 36 : 219)
      doc.setDrawColor(filled ? 245 : 203, filled ? 158 : 213, filled ? 11 : 225)
      doc.setLineWidth(0.15)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(doc as any).lines(segs, pts[0][0], pts[0][1], [1, 1], "FD", true)
    }
    const starStartX = W - m - 54
    const starY = SCORE_TOP + 11
    for (let i = 1; i <= 5; i++) drawStar(starStartX + (i - 1) * 11, starY, 4, i <= sc)

    // ── KPI cards (2 × 4) ────────────────────────────────────────────────────
    const kpiY = 78
    const kpis: { label: string; val: string; col: [number,number,number] }[] = [
      { label: "JOURS ATTENDUS",     val: stats.joursAttendu.toString(),          col: BLUE   },
      { label: "JOURS PRÉSENTS",     val: stats.nbPresentsTotal.toString(),        col: LGREEN },
      { label: "ABSENCES",           val: stats.nbAbsent.toString(),              col: stats.nbAbsent > 0 ? RED : LGREEN },
      { label: "RETARDS",            val: stats.nbRetard.toString(),              col: stats.nbRetard > 0 ? AMBER : LGREEN },
      { label: "TAUX PRÉSENCE",      val: `${stats.tauxPresence}%`,               col: stats.tauxPresence >= 90 ? LGREEN : RED },
      { label: "CUMUL RETARDS",      val: stats.totalMinRetard > 0 ? hm(stats.totalMinRetard) : "—", col: AMBER },
      { label: "HEURES TRAVAILLÉES", val: `${stats.totalHeures.toFixed(1)}h`,     col: BLUE   },
      { label: "HS VALIDÉES",        val: `${stats.totalHSValidees.toFixed(1)}h`, col: LGREEN },
    ]
    const gap = 3
    const kW  = (W - 2 * m - gap * 3) / 4
    const kH  = 17

    kpis.forEach((k, i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const kx  = m + col * (kW + gap)
      const ky  = kpiY + row * (kH + gap)
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3)
      doc.roundedRect(kx, ky, kW, kH, 2, 2, "FD")
      doc.setFillColor(...k.col); doc.roundedRect(kx, ky, 2.5, kH, 1, 1, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...k.col)
      doc.text(k.val, kx + kW / 2, ky + 8, { align: "center" })
      doc.setFont("helvetica", "normal"); doc.setFontSize(5); doc.setTextColor(...GREY)
      doc.text(k.label, kx + kW / 2, ky + 14, { align: "center" })
    })

    // ── Titre section tableau ─────────────────────────────────────────────────
    const tableStartY = kpiY + 2 * (kH + gap) + 5
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY)
    doc.text("Détail journalier", m, tableStartY - 3)

    // ── Tableau via autotable ─────────────────────────────────────────────────
    const allDays = buildCalendar(mois, annee, stats.presences)
    const workDays = allDays.filter(
      c => c && !c.isWeekend && (!c.isFuture || c.presence !== null)
    ) as { date: string; presence: PresenceDetail | null; isWeekend: boolean; isFuture: boolean }[]

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: m, right: m, bottom: FOOT + 2 },
      head: [["Date", "Statut", "Arrivée", "Départ", "Heures", "Retard", "HS", "Notes"]],
      body: workDays.map(({ date, presence: p }) => {
        const statut = p ? p.statut : "ABSENT_ND"
        const cfg    = STATUT_CFG[statut]
        const dn     = new Date(date + "T12:00:00")
          .toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })
        const noteTxt = [
          p?.notes ? p.notes.slice(0, 30) : "",
          p?.saisieManuelle ? "[M]" : "",
        ].filter(Boolean).join(" ")
        return [
          dn,
          cfg?.label ?? statut,
          p?.heureArrivee ?? "—",
          p?.heureDepart  ?? "—",
          p?.heuresTravaillees != null ? `${p.heuresTravaillees.toFixed(1)}h` : "—",
          (p?.minutesRetard ?? 0) > 0 ? hm(p!.minutesRetard) : "—",
          (p?.heuresSupBrutes ?? 0) > 0 ? `+${p!.heuresSupBrutes.toFixed(1)}h` : "—",
          noteTxt,
        ]
      }),
      headStyles: {
        fillColor: NAVY, textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 8.5, cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 8.5, textColor: SLATE, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 24 },
        2: { cellWidth: 17, halign: "center" },
        3: { cellWidth: 17, halign: "center" },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 13, halign: "center" },
        7: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return
        const p = workDays[data.row.index]?.presence
        const statut = p?.statut ?? "ABSENT_ND"
        if (data.column.index === 1) {
          if (statut === "PRESENT")
            data.cell.styles.textColor = [5, 150, 105]
          else if (statut === "RETARD")
            data.cell.styles.textColor = [217, 119, 6]
          else if (statut === "ABSENT" || statut === "ABSENT_ND")
            data.cell.styles.textColor = [220, 38, 38]
          else if (statut === "CONGE")
            data.cell.styles.textColor = [124, 58, 237]
        }
        if (data.column.index === 5 && data.cell.raw !== "—")
          data.cell.styles.textColor = [217, 119, 6]
        if (data.column.index === 6 && data.cell.raw !== "—")
          data.cell.styles.textColor = [5, 150, 105]
      },
    })

    // ── Pied de page sur toutes les pages ─────────────────────────────────────
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      drawFooter(i, totalPages)
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
                  // Weekend sans saisie OU jour futur sans saisie → case grise neutre
                  if ((cell.isWeekend || cell.isFuture) && !p) return (
                    <div key={idx} className="rounded-lg p-1.5 min-h-14 border border-slate-100"
                      style={{ background: cell.isFuture && !cell.isWeekend ? "#f8fafc" : "#f8fafc" }}>
                      <p className="text-[10px] font-semibold text-slate-300 text-center">
                        {parseInt(cell.date.slice(8))}
                      </p>
                      {cell.isFuture && !cell.isWeekend && (
                        <p className="text-[7px] text-center text-slate-300 mt-0.5">—</p>
                      )}
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
                  {(cells.filter(c => c && (!c.isWeekend || c.presence !== null) && (!c.isFuture || c.presence !== null)) as { date: string; presence: PresenceDetail | null; isWeekend: boolean; isFuture: boolean }[])
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
