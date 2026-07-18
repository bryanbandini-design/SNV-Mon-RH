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

  const doc  = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const W    = doc.internal.pageSize.getWidth()
  const H    = doc.internal.pageSize.getHeight()
  const ML   = 12; const MR = 12
  const NAVY: [number,number,number]  = [26, 52, 97]
  const GREEN: [number,number,number] = [122, 179, 46]
  const GRAY: [number,number,number]  = [100, 116, 139]
  const RED: [number,number,number]   = [180, 30, 30]
  const BLUE: [number,number,number]  = [30, 80, 180]

  // Logo
  try {
    const b64 = await loadImageAsBase64("/logo-sanovia.png")
    doc.addImage(b64, "PNG", ML, 6, 50, 12.2)
  } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY)
    doc.text("SANOVIA HEALTH CARE", ML, 16)
  }

  // Titre
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY)
  doc.text("PRÉ-DÉCLARATION SOCIALE & FISCALE", W / 2, 13, { align: "center" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY)
  doc.text(`Période : ${moisLib} ${detail.annee}   |   ${detail.nbSalaries} salarié(s)   |   Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    W / 2, 19, { align: "center" })
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(0, 24, W, 24)

  // ── Section CNPS ──────────────────────────────────────────────────────
  let y = 30
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY)
  doc.setFillColor(...NAVY); doc.rect(ML, y, W - ML - MR, 7, "F")
  doc.setTextColor(255, 255, 255); doc.setFontSize(8.5)
  doc.text("CAISSE NATIONALE DE PRÉVOYANCE SOCIALE (CNPS)", ML + 3, y + 4.8)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
  doc.text(`Taux : Salarié 4,20 %  |  Patronal 13,20 %  |  Plafond mensuel : ${n(CAMEROUN.CNPS_PLAFOND_MENSUEL)} FCFA`, W - MR - 3, y + 4.8, { align: "right" })

  const cnpsRows = detail.salaires.map(s => {
    const base = Math.min(s.brutImposable, CAMEROUN.CNPS_PLAFOND_MENSUEL)
    return [
      s.employe.matricule,
      `${s.employe.prenom} ${s.employe.nom}`,
      s.employe.poste + (s.employe.departement ? ` (${s.employe.departement})` : ""),
      { content: n(base),             styles: { halign: "right" as const } },
      { content: n(s.cnpsSalarie),    styles: { halign: "right" as const, textColor: RED } },
      { content: n(s.cnpsPatronal),   styles: { halign: "right" as const, textColor: RED } },
      { content: n(s.cnpsSalarie + s.cnpsPatronal), styles: { halign: "right" as const, fontStyle: "bold" as const, textColor: RED } },
    ]
  })

  autoTable(doc, {
    startY: y + 8,
    head: [["Matricule", "Nom & Prénom", "Poste", "Brut plafonné", "CNPS salarié\n(4,20 %)", "CNPS patronal\n(13,20 %)", "Total CNPS"]],
    body: cnpsRows,
    foot: [[
      { content: "TOTAL", colSpan: 3, styles: { fontStyle: "bold", fillColor: [26, 52, 97], textColor: [255,255,255] } },
      { content: n(detail.totalBrutCNPS),    styles: { halign: "right", fontStyle: "bold", fillColor: [26,52,97], textColor: [255,255,255] } },
      { content: n(detail.totalCNPSSalarie), styles: { halign: "right", fontStyle: "bold", fillColor: [26,52,97], textColor: [122,179,46] } },
      { content: n(detail.totalCNPSPatronal),styles: { halign: "right", fontStyle: "bold", fillColor: [26,52,97], textColor: [122,179,46] } },
      { content: n(detail.totalCNPS),        styles: { halign: "right", fontStyle: "bold", fillColor: [26,52,97], textColor: [122,179,46] } },
    ]],
    headStyles: { fillColor: [50, 80, 130], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
    footStyles: { fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 38 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
    margin: { left: ML, right: MR },
  })

  // ── Section Impôts ────────────────────────────────────────────────────
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120
  y += 8

  doc.setFillColor(...BLUE); doc.rect(ML, y, W - ML - MR, 7, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255)
  doc.text("IMPÔTS SUR LE REVENU — IRPP · CAC · RAV", ML + 3, y + 4.8)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
  doc.text("Barème progressif Cameroun  |  CAC = 10 % de l'IRPP  |  RAV forfait mensuel", W - MR - 3, y + 4.8, { align: "right" })

  const impotRows = detail.salaires.map(s => [
    s.employe.matricule,
    `${s.employe.prenom} ${s.employe.nom}`,
    { content: n(s.brutImposable), styles: { halign: "right" as const } },
    { content: n(s.irpp),          styles: { halign: "right" as const, textColor: RED } },
    { content: n(s.cac),           styles: { halign: "right" as const, textColor: RED } },
    { content: n(s.rav),           styles: { halign: "right" as const, textColor: RED } },
    { content: n(s.irpp + s.cac + s.rav), styles: { halign: "right" as const, fontStyle: "bold" as const, textColor: RED } },
  ])

  autoTable(doc, {
    startY: y + 8,
    head: [["Matricule", "Nom & Prénom", "Brut imposable", "IRPP", "CAC (10 %)", "RAV", "Total Impôts"]],
    body: impotRows,
    foot: [[
      { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", fillColor: [30, 80, 180], textColor: [255,255,255] } },
      { content: "", styles: { fillColor: [30, 80, 180] } },
      { content: n(detail.totalIRPP),    styles: { halign: "right", fontStyle: "bold", fillColor: [30,80,180], textColor: [122,179,46] } },
      { content: n(detail.totalCAC),     styles: { halign: "right", fontStyle: "bold", fillColor: [30,80,180], textColor: [122,179,46] } },
      { content: n(detail.totalRAV),     styles: { halign: "right", fontStyle: "bold", fillColor: [30,80,180], textColor: [122,179,46] } },
      { content: n(detail.totalImpots),  styles: { halign: "right", fontStyle: "bold", fillColor: [30,80,180], textColor: [122,179,46] } },
    ]],
    headStyles: { fillColor: [40, 100, 200], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
    footStyles: { fontSize: 8, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { cellWidth: 28, halign: "right" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
    margin: { left: ML, right: MR },
  })

  // ── Récapitulatif ─────────────────────────────────────────────────────
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200
  y += 8

  // Vérification que ça tient sur la page, sinon nouvelle page
  if (y > H - 60) { doc.addPage(); y = 20 }

  doc.setFillColor(243, 249, 231); doc.setDrawColor(...GREEN); doc.setLineWidth(0.5)
  doc.rect(ML, y, W - ML - MR, 32, "FD")
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...NAVY)
  doc.text("RÉCAPITULATIF — MONTANTS À VERSER", ML + 4, y + 7)

  const mid = ML + (W - ML - MR) / 2
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY)
  doc.text(`Total CNPS à verser (salarié + patronal) :`, ML + 4, y + 14)
  doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY)
  doc.text(`${n(detail.totalCNPS)} FCFA`, mid - 4, y + 14, { align: "right" })

  doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY)
  doc.text(`Total Impôts à verser (IRPP + CAC + RAV) :`, ML + 4, y + 20)
  doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY)
  doc.text(`${n(detail.totalImpots)} FCFA`, mid - 4, y + 20, { align: "right" })

  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.line(ML + 4, y + 23, mid - 4, y + 23)
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY)
  doc.text("TOTAL GÉNÉRAL À VERSER :", ML + 4, y + 29)
  doc.setTextColor(...GREEN); doc.setFontSize(13)
  doc.text(`${n(detail.totalAVerser)} FCFA`, mid - 4, y + 29, { align: "right" })

  // Références légales
  doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...GRAY)
  doc.text("Réf. légale Cameroun : Déclaration CNPS — avant le 15 du mois suivant  |  IRPP — mensualisation selon le CGI Cameroun", ML + 4, y + 36)

  // Mention autogénéré
  y += 42
  doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(...GRAY)
  doc.text(
    `Document autogénéré le ${new Date().toLocaleDateString("fr-FR")} par la plateforme RH SANOVIA — Pré-déclaration à usage interne destinée au fiscaliste. Ne constitue pas une déclaration officielle.`,
    W / 2, y, { align: "center", maxWidth: W - ML - MR }
  )

  // Footer
  const FOOT_H = 14
  doc.setFillColor(...NAVY); doc.rect(0, H - FOOT_H, W, FOOT_H, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255)
  doc.text("SANOVIA Health Care", W / 2, H - FOOT_H + 5, { align: "center" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(6)
  doc.text("Tel : 656 67 67 67  —  670 44 55 68   |   shcdg@sanoviahc.com   |   NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
    W / 2, H - FOOT_H + 10, { align: "center" })

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

  useEffect(() => {
    fetch("/api/declarations")
      .then(r => r.ok ? r.json() : [])
      .then(d => { setDeclarations(Array.isArray(d) ? d : []); setLoadingInit(false) })
  }, [])

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
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Déclarations sociales &amp; fiscales</h1>
        <p className="text-sm text-slate-500 mt-1">
          CNPS · IRPP · CAC · RAV — générées automatiquement à chaque paiement de salaire
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-lg font-black text-slate-900 truncate">{c.value}</p>
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
                    className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${retard && decl.statut !== "SOLDEE" ? "bg-red-50/40" : ""}`}
                    onClick={() => toggleDetail(decl.id)}
                  >
                    {/* Période */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${si.dot}`} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{MOIS[decl.mois - 1]} {decl.annee}</p>
                        <p className="text-xs text-slate-400">{decl.nbSalaries} salarié(s)</p>
                      </div>
                    </div>

                    {/* Chiffres */}
                    <div className="flex-1 grid grid-cols-3 gap-2 text-right">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">CNPS</p>
                        <p className="text-sm font-semibold text-slate-700 tabular-nums">{n(decl.totalCNPS)} F</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Impôts</p>
                        <p className="text-sm font-semibold text-slate-700 tabular-nums">{n(decl.totalImpots)} F</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{n(decl.totalAVerser)} F</p>
                      </div>
                    </div>

                    {/* Statut + flèche */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${si.cls}`}>
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
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <RefreshCw className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Les déclarations sont <strong>mises à jour automatiquement</strong> à chaque paiement de salaire.
          Délai légal Cameroun : cotisations CNPS et impôts à verser avant le <strong>15 du mois suivant</strong> la période de paie.
        </p>
      </div>
    </div>
  )
}
