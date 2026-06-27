import { jsPDF } from "jspdf"
import { TYPES_CONTRAT } from "@/lib/utils"

type Entreprise = { nom: string; adresse: string; rccm: string; niu: string }

const GRAY = [100, 116, 139] as const
const DARK = [15, 23, 42] as const
const LIGHT = [226, 232, 240] as const
const ORANGE = [249, 115, 22] as const

export async function genererFormulaireEmployePDF(entreprise: Entreprise) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W = 210
  const marginL = 16
  const marginR = 16
  const contentW = W - marginL - marginR

  let y = 14

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...DARK)
  doc.text(entreprise.nom, marginL, y)

  if (entreprise.adresse || entreprise.rccm || entreprise.niu) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY)
    y += 5
    if (entreprise.adresse) { doc.text(entreprise.adresse, marginL, y); y += 4 }
    if (entreprise.rccm)    { doc.text(`RCCM : ${entreprise.rccm}`, marginL, y); y += 4 }
    if (entreprise.niu)     { doc.text(`NIU : ${entreprise.niu}`, marginL, y); y += 4 }
    y -= (entreprise.adresse ? 4 : 0) + (entreprise.rccm ? 4 : 0) + (entreprise.niu ? 4 : 0)
  }

  // Titre document (droite)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...DARK)
  doc.text("FICHE D'ENRÔLEMENT SALARIÉ", W - marginR, 14, { align: "right" })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY)
  doc.text("Réf. RH-EMP · À retourner au service RH", W - marginR, 19, { align: "right" })
  doc.text(`Date : _____ / _____ / _______`, W - marginR, 24, { align: "right" })

  y = 30
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.5)
  doc.line(marginL, y, W - marginR, y)
  y += 7

  // ── Helper functions ──────────────────────────────────────────────────────
  function sectionTitle(title: string) {
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...GRAY)
    doc.text(title.toUpperCase(), marginL, y)
    y += 2
    doc.setDrawColor(...LIGHT)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)
    y += 5
  }

  function field(label: string, x: number, fieldY: number, w: number) {
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...GRAY)
    doc.text(label, x, fieldY)
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.3)
    doc.line(x, fieldY + 5, x + w, fieldY + 5)
  }

  function fieldRow(fields: { label: string; w?: number }[]) {
    const totalFields = fields.length
    const gap = 5
    const totalGap = gap * (totalFields - 1)
    const defaultW = (contentW - totalGap) / totalFields
    let x = marginL
    for (const f of fields) {
      const w = f.w ?? defaultW
      field(f.label, x, y, w)
      x += w + gap
    }
    y += 12
  }

  function checkboxField(label: string) {
    doc.setDrawColor(...GRAY)
    doc.setLineWidth(0.3)
    doc.rect(marginL, y - 3, 3.5, 3.5)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...DARK)
    doc.text(label, marginL + 5.5, y)
    y += 7
  }

  function radioOptions(options: string[]) {
    const perRow = 4
    const colW = contentW / perRow
    options.forEach((opt, i) => {
      const col = i % perRow
      const row = Math.floor(i / perRow)
      const rx = marginL + col * colW
      const ry = y + row * 6
      doc.setDrawColor(...GRAY)
      doc.setLineWidth(0.25)
      doc.circle(rx + 1.5, ry - 1.5, 1.5)
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...DARK)
      doc.text(opt, rx + 5, ry)
    })
    const rows = Math.ceil(options.length / perRow)
    y += rows * 6 + 4
  }

  function noteBox(h: number = 20) {
    doc.setDrawColor(...LIGHT)
    doc.setLineWidth(0.3)
    doc.rect(marginL, y, contentW, h)
    y += h + 5
  }

  // ── 1. Informations personnelles ──────────────────────────────────────────
  sectionTitle("1 — Informations personnelles")
  fieldRow([{ label: "Prénom *" }, { label: "Nom *" }])
  fieldRow([{ label: "Date de naissance" }, { label: "Lieu de naissance" }])
  fieldRow([{ label: "Nationalité" }, { label: "CNI / Passeport (N°)" }])
  fieldRow([{ label: "Email" }, { label: "Téléphone" }])
  fieldRow([{ label: "Adresse complète", w: contentW }])
  y += 2

  // ── 2. Informations professionnelles ─────────────────────────────────────
  sectionTitle("2 — Informations professionnelles")
  fieldRow([{ label: "Matricule *" }, { label: "Poste *" }])
  fieldRow([{ label: "Département / Service" }, { label: "Date d'embauche *" }])
  fieldRow([{ label: "Date fin de contrat (si applicable)" }, { label: "Salaire de base brut (FCFA) *" }])

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...GRAY)
  doc.text("TYPE DE CONTRAT *", marginL, y)
  y += 4
  radioOptions(TYPES_CONTRAT)

  // ── 3. Période d'essai ────────────────────────────────────────────────────
  sectionTitle("3 — Période d'essai")

  // Badge orange avertissement
  doc.setFillColor(...ORANGE)
  doc.setDrawColor(...ORANGE)
  doc.roundedRect(marginL, y - 4, contentW, 8, 1, 1, "F")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text("Un badge « Période d'essai » sera visible sur la fiche jusqu'à la date de fin.", marginL + 3, y)
  y += 8

  checkboxField("Le salarié est soumis à une période d'essai")
  fieldRow([{ label: "Début de la période d'essai" }, { label: "Fin de la période d'essai" }])

  // ── 4. Observations ───────────────────────────────────────────────────────
  sectionTitle("4 — Observations / Notes")
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY)
  doc.text("Informations complémentaires", marginL, y)
  y += 3
  noteBox(18)

  // ── Signatures ────────────────────────────────────────────────────────────
  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.4)
  doc.line(marginL, y, W - marginR, y)
  y += 8

  const halfW = (contentW - 10) / 2
  // Signature salarié
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...GRAY)
  doc.text("SIGNATURE DU SALARIÉ", marginL, y)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(marginL, y + 18, marginL + halfW, y + 18)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY)
  doc.text("Nom & Signature", marginL, y + 21)

  // Visa RH
  const rhX = marginL + halfW + 10
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...GRAY)
  doc.text("VISA DU RESPONSABLE RH", rhX, y)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(rhX, y + 18, rhX + halfW, y + 18)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY)
  doc.text("Nom, Signature & Cachet", rhX, y + 21)

  y += 28

  // ── Note bas de page ──────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)
  doc.roundedRect(marginL, y, contentW, 12, 1, 1, "FD")
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...DARK)
  doc.text("Note :", marginL + 3, y + 4.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY)
  doc.text(
    "Les champs marqués * sont obligatoires. Ce formulaire doit être retourné au service RH dûment complété et signé avant toute création du compte salarié.",
    marginL + 14, y + 4.5,
    { maxWidth: contentW - 16 }
  )

  doc.save("formulaire-enrolement-salarie.pdf")
}
