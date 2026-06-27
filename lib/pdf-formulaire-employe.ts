import { TYPES_CONTRAT } from "@/lib/utils"

type Entreprise = { nom: string; adresse: string; rccm: string; niu: string }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function genererFormulaireEmployePDF(entreprise: Entreprise) {
  const { jsPDF } = await import("jspdf")

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W = 210
  const mL = 16
  const mR = 16
  const cW = W - mL - mR

  let y = 14

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(15, 23, 42)
  doc.text(entreprise.nom, mL, y)

  let headerLines = 0
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  if (entreprise.adresse) { y += 5; doc.text(entreprise.adresse, mL, y); headerLines++ }
  if (entreprise.rccm)    { y += 4; doc.text(`RCCM : ${entreprise.rccm}`, mL, y); headerLines++ }
  if (entreprise.niu)     { y += 4; doc.text(`NIU : ${entreprise.niu}`, mL, y); headerLines++ }
  if (headerLines === 0) y += 2

  // Titre à droite
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(15, 23, 42)
  doc.text("FICHE D'ENRÔLEMENT SALARIÉ", W - mR, 14, { align: "right" })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("Réf. RH-EMP  ·  À retourner au service RH", W - mR, 19, { align: "right" })
  doc.text("Date : _____ / _____ / _______", W - mR, 25, { align: "right" })

  y = Math.max(y + 4, 32)
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.5)
  doc.line(mL, y, W - mR, y)
  y += 7

  // ── Helpers ───────────────────────────────────────────────────────────────
  function sectionTitle(title: string) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(100, 116, 139)
    doc.text(title, mL, y)
    y += 2
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(mL, y, W - mR, y)
    y += 5
  }

  function drawField(label: string, x: number, fy: number, w: number) {
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(100, 116, 139)
    doc.text(label, x, fy)
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.3)
    doc.line(x, fy + 5.5, x + w, fy + 5.5)
  }

  function fieldRow(labels: string[], widths?: number[]) {
    const gap = 6
    const n = labels.length
    const defaultW = (cW - gap * (n - 1)) / n
    let x = mL
    labels.forEach((label, i) => {
      const w = widths ? widths[i] : defaultW
      drawField(label, x, y, w)
      x += w + gap
    })
    y += 13
  }

  // ── 1. Informations personnelles ──────────────────────────────────────────
  sectionTitle("1 — INFORMATIONS PERSONNELLES")
  fieldRow(["Prénom *", "Nom *"])
  fieldRow(["Date de naissance", "Lieu de naissance"])
  fieldRow(["Nationalité", "CNI / Passeport (N°)"])
  fieldRow(["Email", "Téléphone"])
  fieldRow(["Adresse complète"], [cW])
  y += 2

  // ── 2. Informations professionnelles ─────────────────────────────────────
  sectionTitle("2 — INFORMATIONS PROFESSIONNELLES")
  fieldRow(["Matricule *", "Poste *"])
  fieldRow(["Département / Service", "Date d'embauche *"])
  fieldRow(["Date fin de contrat (si applicable)", "Salaire de base brut (FCFA) *"])

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139)
  doc.text("TYPE DE CONTRAT *", mL, y)
  y += 4

  const perRow = 4
  const colW = cW / perRow
  TYPES_CONTRAT.forEach((t, i) => {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    const rx = mL + col * colW
    const ry = y + row * 6.5
    doc.setDrawColor(100, 116, 139)
    doc.setLineWidth(0.3)
    doc.rect(rx, ry - 3, 3, 3)
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 41, 59)
    doc.text(t, rx + 4.5, ry)
  })
  y += Math.ceil(TYPES_CONTRAT.length / perRow) * 6.5 + 4

  // ── 3. Période d'essai ────────────────────────────────────────────────────
  sectionTitle("3 — PÉRIODE D'ESSAI")

  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.3)
  doc.rect(mL, y - 3, 3.5, 3.5)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(30, 41, 59)
  doc.text("Le salarié est soumis à une période d'essai", mL + 5.5, y)
  y += 7

  fieldRow(["Début de la période d'essai", "Fin de la période d'essai"])

  // ── 4. Observations ───────────────────────────────────────────────────────
  sectionTitle("4 — OBSERVATIONS / NOTES")
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("Informations complémentaires", mL, y)
  y += 3
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.rect(mL, y, cW, 20)
  y += 25

  // ── Signatures ────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(mL, y, W - mR, y)
  y += 8

  const halfW = (cW - 10) / 2
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139)
  doc.text("SIGNATURE DU SALARIÉ", mL, y)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(mL, y + 18, mL + halfW, y + 18)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Nom & Signature", mL, y + 22)

  const rhX = mL + halfW + 10
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139)
  doc.text("VISA DU RESPONSABLE RH", rhX, y)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(rhX, y + 18, rhX + halfW, y + 18)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text("Nom, Signature & Cachet", rhX, y + 22)

  y += 28

  // ── Note bas de page ──────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.rect(mL, y, cW, 14, "FD")
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(15, 23, 42)
  doc.text("Note :", mL + 3, y + 5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)
  doc.text(
    "Les champs * sont obligatoires. Ce formulaire doit être retourné au service RH dûment complété et signé avant toute création du compte salarié.",
    mL + 14, y + 5,
    { maxWidth: cW - 16 }
  )

  // ── Téléchargement ────────────────────────────────────────────────────────
  const blob = doc.output("blob")
  downloadBlob(blob, "formulaire-enrolement-salarie.pdf")
}
