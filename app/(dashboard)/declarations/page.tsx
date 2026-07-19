"use client"

import { useState, useEffect } from "react"
import {
  FileText, Check, AlertCircle, Send, Loader2,
  ChevronDown, ChevronUp, Building2, Scale, Download,
  CircleDollarSign, RefreshCw, CheckCircle2,
} from "lucide-react"
import { formatCurrency, MOIS } from "@/lib/utils"
import { toast } from "sonner"
import { CAMEROUN } from "@/lib/cameroun-salaire"

// ── Types ──────────────────────────────────────────────────────────────────
type Declaration = {
  id: string; mois: number; annee: number; statut: string
  totalBrutCNPS: number; totalCNPSSalarie: number; totalCNPSPatronal: number; totalCNPS: number
  totalIRPP: number; totalCAC: number; totalRAV: number; totalImpots: number
  totalAVerser: number; nbSalaries: number
  dateTransmission: string | null; datePaiementCNPS: string | null; datePaiementImpots: string | null
  notes: string | null; createdAt: string
}
type SalaireDetail = {
  id: string; brutImposable: number; cnpsSalarie: number; cnpsPatronal: number
  irpp: number; cac: number; rav: number; netAPayer: number; salaireBase: number
  employe: { prenom: string; nom: string; matricule: string; poste: string; departement?: string }
}
type DeclarationDetail = Declaration & { salaires: SalaireDetail[] }

// ── Helpers ────────────────────────────────────────────────────────────────
function n(v: number) { return Math.round(v).toLocaleString("fr-FR") }

function isEnRetard(d: Declaration) {
  // Délai légal Cameroun : 15 du mois suivant la période
  const limite = new Date(d.annee, d.mois, 15)
  return new Date() > limite && d.statut !== "SOLDEE"
}

function statutInfo(d: Declaration) {
  if (d.statut === "SOLDEE")       return { label: "Soldée",      cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" }
  if (d.statut === "TRANSMISE" && !isEnRetard(d)) return { label: "Transmise",   cls: "bg-blue-100 text-blue-700",    dot: "bg-blue-500" }
  if (isEnRetard(d))               return { label: "En arriéré",  cls: "bg-red-100 text-red-700",         dot: "bg-red-500" }
  return                                  { label: "À traiter",   cls: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" }
}

async function loadImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url); const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ── Génération PDF ─────────────────────────────────────────────────────────
async function genererPDF(detail: DeclarationDetail) {
  const { jsPDF }     = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")
  const moisLib = MOIS[detail.mois - 1] ?? `Mois ${detail.mois}`

  // Formateur numérique pour PDF — toLocaleString("fr-FR") produit une espace insécable
  // étroite (U+202F) que jsPDF encode en "/" dans WinAnsi. On utilise une espace normale.
  const pn = (v: number) =>
    Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")

  // ── Document A4 paysage ──────────────────────────────────────────────────
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const W   = doc.internal.pageSize.getWidth()   // 297 mm
  const H   = doc.internal.pageSize.getHeight()  // 210 mm
  const ML  = 12
  const MR  = 12
  const TW  = W - ML - MR                        // 273 mm disponibles

  // ── Palette ──────────────────────────────────────────────────────────────
  const NAVY:      [number,number,number] = [18,  44,  84]
  const NAVY_MED:  [number,number,number] = [35,  70, 130]
  const BLUE:      [number,number,number] = [28,  88, 200]
  const BLUE_MED:  [number,number,number] = [40, 110, 200]
  const GREEN_ACC: [number,number,number] = [28, 160,  60]
  const GREEN_TXT: [number,number,number] = [80, 210,  90]
  const GRAY:      [number,number,number] = [100,116, 139]
  const RED:       [number,number,number] = [190,  30,  30]
  const WHITE:     [number,number,number] = [255, 255, 255]
  const ROW_ALT:   [number,number,number] = [246, 249, 255]
  const LINE_CLR:  [number,number,number] = [210, 222, 238]

  // ── En-tête ───────────────────────────────────────────────────────────────
  try {
    const b64 = await loadImageAsBase64("/logo-sanovia.png")
    doc.addImage(b64, "PNG", ML, 4, 38, 9.5)
  } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9)
    doc.setTextColor(...NAVY); doc.text("SANOVIA HEALTH CARE", ML, 11)
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY)
  doc.text("PRÉ-DÉCLARATION SOCIALE & FISCALE", W / 2, 9, { align: "center" })

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY)
  doc.text(
    `Période : ${moisLib} ${detail.annee}   ·   ${detail.nbSalaries} salarié(s)   ·   Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    W / 2, 14.5, { align: "center" }
  )

  doc.setDrawColor(...GREEN_ACC); doc.setLineWidth(0.7)
  doc.line(ML, 18.5, W - MR, 18.5)

  // ── Section CNPS ─────────────────────────────────────────────────────────
  let y = 22

  doc.setFillColor(...NAVY); doc.rect(ML, y, TW, 6.5, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...WHITE)
  doc.text("CAISSE NATIONALE DE PRÉVOYANCE SOCIALE (CNPS)", ML + 3, y + 4.3)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...WHITE)
  doc.text(
    `Salarié 4,20 %   |   Patronal 13,20 %   |   Plafond : ${pn(CAMEROUN.CNPS_PLAFOND_MENSUEL)} FCFA/mois`,
    W - MR - 2, y + 4.3, { align: "right" }
  )

  const cnpsRows = detail.salaires.map(s => {
    const base = Math.min(s.brutImposable, CAMEROUN.CNPS_PLAFOND_MENSUEL)
    return [
      s.employe.matricule,
      `${s.employe.prenom} ${s.employe.nom}`,
      s.employe.poste + (s.employe.departement ? ` (${s.employe.departement})` : ""),
      { content: pn(base),                            styles: { halign: "right" as const } },
      { content: pn(s.cnpsSalarie),                   styles: { halign: "right" as const, textColor: RED } },
      { content: pn(s.cnpsPatronal),                  styles: { halign: "right" as const, textColor: RED } },
      { content: pn(s.cnpsSalarie + s.cnpsPatronal),  styles: { halign: "right" as const, fontStyle: "bold" as const, textColor: RED } },
    ]
  })

  autoTable(doc, {
    startY: y + 7,
    head: [["Matricule", "Nom & Prénom", "Poste", "Brut plafonné\n(FCFA)", "CNPS salarié\n4,20 %", "CNPS patronal\n13,20 %", "Total CNPS\n(FCFA)"]],
    body: cnpsRows,
    foot: [[
      { content: "TOTAL", colSpan: 3, styles: { fontStyle: "bold", fillColor: NAVY, textColor: WHITE } },
      { content: pn(detail.totalBrutCNPS),    styles: { halign: "right", fontStyle: "bold", fillColor: NAVY, textColor: WHITE } },
      { content: pn(detail.totalCNPSSalarie), styles: { halign: "right", fontStyle: "bold", fillColor: NAVY, textColor: GREEN_TXT } },
      { content: pn(detail.totalCNPSPatronal),styles: { halign: "right", fontStyle: "bold", fillColor: NAVY, textColor: GREEN_TXT } },
      { content: pn(detail.totalCNPS),        styles: { halign: "right", fontStyle: "bold", fillColor: NAVY, textColor: GREEN_TXT } },
    ]],
    headStyles: {
      fillColor: NAVY_MED, textColor: WHITE,
      fontSize: 7.5, fontStyle: "bold", halign: "center" as const,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      valign: "middle" as const,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
      textColor: [20, 30, 50] as [number,number,number],
      valign: "middle" as const,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    footStyles: {
      fontSize: 8, fontStyle: "bold",
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 52 },
      2: { cellWidth: "auto" as const },
      3: { cellWidth: 28, halign: "right" as const },
      4: { cellWidth: 27, halign: "right" as const },
      5: { cellWidth: 27, halign: "right" as const },
      6: { cellWidth: 27, halign: "right" as const },
    },
    margin: { left: ML, right: MR },
    styles: { font: "helvetica", lineColor: LINE_CLR, lineWidth: 0.2, overflow: "linebreak" as const },
  })

  // ── Section Impôts ────────────────────────────────────────────────────────
  y = ((doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110) + 5

  doc.setFillColor(...BLUE); doc.rect(ML, y, TW, 6.5, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...WHITE)
  doc.text("IMPÔTS SUR LE REVENU — IRPP · CAC · RAV", ML + 3, y + 4.3)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...WHITE)
  doc.text(
    "Barème progressif Cameroun   |   CAC = 10 % de l'IRPP   |   RAV forfait mensuel",
    W - MR - 2, y + 4.3, { align: "right" }
  )

  const impotRows = detail.salaires.map(s => [
    s.employe.matricule,
    `${s.employe.prenom} ${s.employe.nom}`,
    s.employe.poste,
    { content: pn(s.brutImposable),          styles: { halign: "right" as const } },
    { content: pn(s.irpp),                   styles: { halign: "right" as const, textColor: RED } },
    { content: pn(s.cac),                    styles: { halign: "right" as const, textColor: RED } },
    { content: pn(s.rav),                    styles: { halign: "right" as const, textColor: [140,70,0] as [number,number,number] } },
    { content: pn(s.irpp + s.cac + s.rav),   styles: { halign: "right" as const, fontStyle: "bold" as const, textColor: RED } },
  ])

  autoTable(doc, {
    startY: y + 7,
    head: [["Matricule", "Nom & Prénom", "Poste", "Brut imposable\n(FCFA)", "IRPP", "CAC\n(10 %)", "RAV", "Total impôts\n(FCFA)"]],
    body: impotRows,
    foot: [[
      { content: "TOTAL", colSpan: 3, styles: { fontStyle: "bold", fillColor: BLUE, textColor: WHITE } },
      { content: "",                   styles: { fillColor: BLUE } },
      { content: pn(detail.totalIRPP),   styles: { halign: "right", fontStyle: "bold", fillColor: BLUE, textColor: GREEN_TXT } },
      { content: pn(detail.totalCAC),    styles: { halign: "right", fontStyle: "bold", fillColor: BLUE, textColor: GREEN_TXT } },
      { content: pn(detail.totalRAV),    styles: { halign: "right", fontStyle: "bold", fillColor: BLUE, textColor: GREEN_TXT } },
      { content: pn(detail.totalImpots), styles: { halign: "right", fontStyle: "bold", fillColor: BLUE, textColor: GREEN_TXT } },
    ]],
    headStyles: {
      fillColor: BLUE_MED, textColor: WHITE,
      fontSize: 7.5, fontStyle: "bold", halign: "center" as const,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      valign: "middle" as const,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
      textColor: [20, 30, 50] as [number,number,number],
      valign: "middle" as const,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    footStyles: {
      fontSize: 8, fontStyle: "bold",
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 52 },
      2: { cellWidth: "auto" as const },
      3: { cellWidth: 28, halign: "right" as const },
      4: { cellWidth: 24, halign: "right" as const },
      5: { cellWidth: 22, halign: "right" as const },
      6: { cellWidth: 20, halign: "right" as const },
      7: { cellWidth: 26, halign: "right" as const },
    },
    margin: { left: ML, right: MR },
    styles: { font: "helvetica", lineColor: LINE_CLR, lineWidth: 0.2, overflow: "linebreak" as const },
  })

  // ── Récapitulatif ─────────────────────────────────────────────────────────
  y = ((doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 170) + 5

  const FOOT_H = 13
  if (y + 46 > H - FOOT_H - 2) { doc.addPage(); y = 14 }

  // Deux encadrés côte à côte
  const boxW = (TW - 5) / 2
  const boxH = 20

  doc.setFillColor(236, 243, 255); doc.setDrawColor(...NAVY); doc.setLineWidth(0.5)
  doc.roundedRect(ML, y, boxW, boxH, 1.5, 1.5, "FD")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...NAVY)
  doc.text("CNPS À VERSER", ML + boxW / 2, y + 5.5, { align: "center" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...GRAY)
  doc.text("(cotisation salarié + patronal)", ML + boxW / 2, y + 9, { align: "center" })
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY)
  doc.text(`${pn(detail.totalCNPS)} FCFA`, ML + boxW / 2, y + 16, { align: "center" })

  const box2X = ML + boxW + 5
  doc.setFillColor(236, 243, 255); doc.setDrawColor(...BLUE)
  doc.roundedRect(box2X, y, boxW, boxH, 1.5, 1.5, "FD")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...BLUE)
  doc.text("IMPÔTS À VERSER", box2X + boxW / 2, y + 5.5, { align: "center" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...GRAY)
  doc.text("(IRPP + CAC + RAV)", box2X + boxW / 2, y + 9, { align: "center" })
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...BLUE)
  doc.text(`${pn(detail.totalImpots)} FCFA`, box2X + boxW / 2, y + 16, { align: "center" })

  // Barre total général
  y += boxH + 3
  doc.setFillColor(...NAVY); doc.rect(ML, y, TW, 11, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE)
  doc.text("TOTAL GÉNÉRAL À VERSER :", ML + 4, y + 7.2)
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...GREEN_TXT)
  doc.text(`${pn(detail.totalAVerser)} FCFA`, W - MR - 3, y + 7.5, { align: "right" })

  // Mentions légales
  y += 15
  doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(...GRAY)
  doc.text(
    "Réf. légale Cameroun : Déclaration CNPS — avant le 15 du mois suivant   |   IRPP — mensualisation selon le Code Général des Impôts camerounais",
    W / 2, y, { align: "center" }
  )
  y += 4.5
  doc.text(
    `Document autogénéré le ${new Date().toLocaleDateString("fr-FR")} par la plateforme RH SANOVIA — Pré-déclaration à usage interne destinée au fiscaliste. Ne constitue pas une déclaration officielle.`,
    W / 2, y, { align: "center", maxWidth: TW - 10 }
  )

  // ── Pied de page ─────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY); doc.rect(0, H - FOOT_H, W, FOOT_H, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...WHITE)
  doc.text("SANOVIA Health Care", W / 2, H - FOOT_H + 4.5, { align: "center" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5)
  doc.setTextColor(190, 210, 235)
  doc.text(
    "Tel : 656 67 67 67  —  670 44 55 68   |   shcdg@sanoviahc.com   |   NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
    W / 2, H - FOOT_H + 9, { align: "center" }
  )

  doc.save(`predeclaration_${moisLib.toLowerCase()}_${detail.annee}.pdf`)
}

// ── Composant principal ────────────────────────────────────────────────────
export default function DeclarationsPage() {
  const [declarations,  setDeclarations]  = useState<Declaration[]>([])
  const [detail,        setDetail]        = useState<DeclarationDetail | null>(null)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [loadingInit,   setLoadingInit]   = useState(true)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pdfLoading,    setPdfLoading]    = useState(false)
  const [resyncLoading, setResyncLoading] = useState(false)

  async function reload() {
    setLoadingInit(true)
    const data = await fetch("/api/declarations").then(r => r.ok ? r.json() : [])
    setDeclarations(Array.isArray(data) ? data : [])
    setLoadingInit(false)
  }

  useEffect(() => { reload() }, [])

  async function resync() {
    setResyncLoading(true)
    const res = await fetch("/api/declarations/resync", { method: "POST" })
    if (res.ok) {
      const { count } = await res.json()
      toast.success(`${count} déclaration(s) recalculée(s) — prestataires exclus`)
      await reload()
    } else {
      toast.error("Erreur lors du recalcul")
    }
    setResyncLoading(false)
  }

  async function toggleDetail(id: string) {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return }
    setLoadingDetail(id)
    const res = await fetch(`/api/declarations/${id}`)
    if (res.ok) { setDetail(await res.json()); setExpandedId(id) }
    setLoadingDetail(null)
  }

  async function doAction(id: string, action: string, label: string) {
    setActionLoading(action + id)
    const res = await fetch(`/api/declarations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDeclarations(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d))
      if (detail?.id === id) setDetail(prev => prev ? { ...prev, ...updated } : null)
      toast.success(label)
    } else toast.error("Erreur lors de la mise à jour")
    setActionLoading(null)
  }

  async function handlePDF() {
    if (!detail) return
    setPdfLoading(true)
    try { await genererPDF(detail) } catch { toast.error("Erreur lors de la génération PDF") }
    setPdfLoading(false)
  }

  // ── Stats globales ──
  const nonSoldees  = declarations.filter(d => d.statut !== "SOLDEE")
  const totalCNPS   = nonSoldees.reduce((s, d) => s + d.totalCNPS,   0)
  const totalImpots = nonSoldees.reduce((s, d) => s + d.totalImpots, 0)
  const totalGlobal = totalCNPS + totalImpots
  const nbArriers   = declarations.filter(d => isEnRetard(d)).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Déclarations sociales &amp; fiscales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            CNPS · IRPP · CAC · RAV — générées automatiquement à chaque paiement de salaire
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={resync}
            disabled={resyncLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Recalculer les totaux en excluant les prestataires"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resyncLoading ? "animate-spin" : ""}`} />
            {resyncLoading ? "Recalcul…" : "Recalculer"}
          </button>
          <span className="text-xs text-slate-400">Délai légal : avant le 15 du mois suivant</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: "CNPS à verser",    value: formatCurrency(totalCNPS),   icon: Building2,        color: "#1a3461", bg: "#eef2ff", sub: "salarié + patronal" },
          { label: "Impôts à verser",  value: formatCurrency(totalImpots), icon: Scale,            color: "#1e5bb8", bg: "#eff6ff", sub: "IRPP + CAC + RAV" },
          { label: "Total à verser",   value: formatCurrency(totalGlobal), icon: CircleDollarSign, color: "#059669", bg: "#ecfdf5", sub: "déclarations en cours" },
          { label: "En arriéré",       value: String(nbArriers),           icon: AlertCircle,      color: "#dc2626", bg: "#fef2f2", sub: nbArriers > 0 ? "délai légal dépassé" : "aucun arriéré" },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
              <c.icon className="h-5 w-5" style={{ color: c.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="text-base sm:text-lg font-black text-slate-900 truncate">{c.value}</p>
              <p className="text-[10px] text-slate-400">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau des déclarations */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-900 text-sm">
            Déclarations par période ({declarations.length})
          </span>
        </div>

        {loadingInit ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : declarations.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-slate-500">Aucune déclaration</p>
            <p className="text-sm mt-1">Les déclarations sont créées automatiquement lors du marquage d&apos;un salaire comme payé.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {declarations.map(decl => {
              const si       = statutInfo(decl)
              const retard   = isEnRetard(decl)
              const isOpen   = expandedId === decl.id
              const loading  = loadingDetail === decl.id

              return (
                <div key={decl.id}>
                  {/* Ligne résumé */}
                  <div
                    className={`px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${retard && decl.statut !== "SOLDEE" ? "bg-red-50/40" : ""}`}
                    onClick={() => toggleDetail(decl.id)}
                  >
                    {/* Période */}
                    <div className="flex items-center gap-3 min-w-[130px] flex-shrink-0">
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${si.dot}`} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{MOIS[decl.mois - 1]} {decl.annee}</p>
                        <p className="text-xs text-slate-400">{decl.nbSalaries} salarié(s)</p>
                      </div>
                    </div>

                    {/* Chiffres + confirmation paiement inline */}
                    <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-2">
                      {/* CNPS */}
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide">CNPS</p>
                          <p className="text-sm font-semibold text-[#1a3461] tabular-nums">{n(decl.totalCNPS)} F</p>
                        </div>
                        {decl.datePaiementCNPS ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5" /> Payée
                          </span>
                        ) : decl.statut !== "SOLDEE" ? (
                          <button
                            onClick={e => { e.stopPropagation(); doAction(decl.id, "PAYER_CNPS", "Paiement CNPS enregistré") }}
                            disabled={!!actionLoading}
                            className="text-[10px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap transition-colors">
                            {actionLoading === "PAYER_CNPS" + decl.id ? "…" : "Confirmer ✓"}
                          </button>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5" /> Soldée
                          </span>
                        )}
                      </div>

                      {/* Impôts */}
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Impôts</p>
                          <p className="text-sm font-semibold text-[#1e5bb8] tabular-nums">{n(decl.totalImpots)} F</p>
                        </div>
                        {decl.datePaiementImpots ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5" /> Payés
                          </span>
                        ) : decl.statut !== "SOLDEE" ? (
                          <button
                            onClick={e => { e.stopPropagation(); doAction(decl.id, "PAYER_IMPOTS", "Paiement impôts enregistré") }}
                            disabled={!!actionLoading}
                            className="text-[10px] font-semibold bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full hover:bg-purple-100 disabled:opacity-50 whitespace-nowrap transition-colors">
                            {actionLoading === "PAYER_IMPOTS" + decl.id ? "…" : "Confirmer ✓"}
                          </button>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5" /> Soldés
                          </span>
                        )}
                      </div>

                      {/* Total */}
                      <div className="ml-auto text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{n(decl.totalAVerser)} F</p>
                      </div>
                    </div>

                    {/* Statut + flèche */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${si.cls}`}>
                        {si.label}
                      </span>
                      {loading
                        ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        : isOpen
                          ? <ChevronUp className="h-4 w-4 text-slate-400" />
                          : <ChevronDown className="h-4 w-4 text-slate-400" />
                      }
                    </div>
                  </div>

                  {/* Détail expandé */}
                  {isOpen && detail?.id === decl.id && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-5 space-y-5">

                      {/* Boutons d'action */}
                      <div className="flex flex-wrap items-center gap-2">
                        {decl.statut === "BROUILLON" && (
                          <button
                            onClick={() => doAction(decl.id, "TRANSMETTRE", "Déclaration marquée transmise au fiscaliste")}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                            {actionLoading === "TRANSMETTRE" + decl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Marquer transmise
                          </button>
                        )}
                        {!detail.datePaiementCNPS && (
                          <button
                            onClick={() => doAction(decl.id, "PAYER_CNPS", "Paiement CNPS enregistré")}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                            {actionLoading === "PAYER_CNPS" + decl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Building2 className="h-3 w-3" />}
                            CNPS payée
                          </button>
                        )}
                        {!detail.datePaiementImpots && (
                          <button
                            onClick={() => doAction(decl.id, "PAYER_IMPOTS", "Paiement impôts enregistré")}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                            {actionLoading === "PAYER_IMPOTS" + decl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scale className="h-3 w-3" />}
                            Impôts payés
                          </button>
                        )}
                        {decl.statut !== "SOLDEE" && (
                          <button
                            onClick={() => doAction(decl.id, "SOLDER", "Déclaration soldée — tout est payé")}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                            {actionLoading === "SOLDER" + decl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Tout solder
                          </button>
                        )}
                        <button
                          onClick={handlePDF}
                          disabled={pdfLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 ml-auto">
                          {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          Télécharger pré-déclaration PDF
                        </button>
                      </div>

                      {/* Dates de suivi */}
                      {(detail.dateTransmission || detail.datePaiementCNPS || detail.datePaiementImpots) && (
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          {detail.dateTransmission && (
                            <span className="flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full text-blue-700">
                              <Send className="h-3 w-3" /> Transmise le {new Date(detail.dateTransmission).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                          {detail.datePaiementCNPS && (
                            <span className="flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full text-indigo-700">
                              <Building2 className="h-3 w-3" /> CNPS payée le {new Date(detail.datePaiementCNPS).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                          {detail.datePaiementImpots && (
                            <span className="flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-full text-purple-700">
                              <Scale className="h-3 w-3" /> Impôts payés le {new Date(detail.datePaiementImpots).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tableau CNPS */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-3.5 w-3.5 text-[#1a3461]" />
                          <p className="text-xs font-bold text-[#1a3461] uppercase tracking-wide">CNPS — Cotisations sociales</p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#1a3461] text-white">
                                {["Matricule","Nom & Prénom","Poste","Brut plafonné","CNPS salarié\n4,20 %","CNPS patronal\n13,20 %","Total CNPS"].map(h => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold whitespace-pre-line">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {detail.salaires.map(s => {
                                const base = Math.min(s.brutImposable, CAMEROUN.CNPS_PLAFOND_MENSUEL)
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 text-slate-500">{s.employe.matricule}</td>
                                    <td className="px-3 py-2 font-medium text-slate-800">{s.employe.prenom} {s.employe.nom}</td>
                                    <td className="px-3 py-2 text-slate-500">{s.employe.poste}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{n(base)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium">{n(s.cnpsSalarie)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium">{n(s.cnpsPatronal)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{n(s.cnpsSalarie + s.cnpsPatronal)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#1a3461] text-white font-bold">
                                <td colSpan={3} className="px-3 py-2">TOTAL</td>
                                <td className="px-3 py-2 text-right tabular-nums">{n(detail.totalBrutCNPS)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalCNPSSalarie)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalCNPSPatronal)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalCNPS)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Tableau Impôts */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Scale className="h-3.5 w-3.5 text-[#1e5bb8]" />
                          <p className="text-xs font-bold text-[#1e5bb8] uppercase tracking-wide">Impôts — IRPP · CAC · RAV</p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#1e5bb8] text-white">
                                {["Matricule","Nom & Prénom","Brut imposable","IRPP","CAC (10 %)","RAV","Total Impôts"].map(h => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {detail.salaires.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-500">{s.employe.matricule}</td>
                                  <td className="px-3 py-2 font-medium text-slate-800">{s.employe.prenom} {s.employe.nom}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{n(s.brutImposable)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium">{n(s.irpp)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium">{n(s.cac)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{n(s.rav)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{n(s.irpp + s.cac + s.rav)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#1e5bb8] text-white font-bold">
                                <td colSpan={2} className="px-3 py-2">TOTAL</td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalIRPP)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalCAC)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalRAV)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[#7ab32e]">{n(detail.totalImpots)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Récap total */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-6">
                        <div className="text-center">
                          <p className="text-xs text-slate-400">CNPS total</p>
                          <p className="text-lg font-black text-[#1a3461]">{formatCurrency(detail.totalCNPS)}</p>
                        </div>
                        <div className="text-slate-300 text-xl">+</div>
                        <div className="text-center">
                          <p className="text-xs text-slate-400">Impôts total</p>
                          <p className="text-lg font-black text-[#1e5bb8]">{formatCurrency(detail.totalImpots)}</p>
                        </div>
                        <div className="text-slate-300 text-xl">=</div>
                        <div className="text-center flex-1">
                          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Total à verser</p>
                          <p className="text-2xl font-black text-emerald-600">{formatCurrency(detail.totalAVerser)}</p>
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

      {/* Note légale */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-400">
        <RefreshCw className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <p>Déclarations <strong className="text-slate-500">mises à jour automatiquement</strong> à chaque paiement. Droit camerounais : CNPS + Impôts à verser avant le <strong className="text-slate-500">15 du mois suivant</strong>.</p>
      </div>
    </div>
  )
}
