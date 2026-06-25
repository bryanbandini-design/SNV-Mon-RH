"use client"

import { useState } from "react"
import { FileText, Loader2, ChevronDown } from "lucide-react"

// ── Palette SANOVIA ──────────────────────────────────────────────────────────
const NAVY  : [number,number,number] = [26,  52,  97]
const GREEN : [number,number,number] = [122, 179,  46]
const GRAY  : [number,number,number] = [100, 116, 139]
const SLATE : [number,number,number] = [51,   65,  85]

async function loadImageAsBase64(url: string): Promise<string> {
  const res  = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Formate un montant sans espace unicode ( ) que jsPDF affiche mal
function montant(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

// Hauteur d'une ligne en mm pour une taille de police donnée (pt)
function lh(ptSize: number, factor = 1.45): number {
  return (ptSize * factor) / 2.835
}

async function genererAttestation(employeId: string, type: "TRAVAIL" | "SALAIRE") {
  const res = await fetch(`/api/documents/attestation?employeId=${employeId}&type=${type}`)
  if (!res.ok) return

  const data = await res.json()
  const { default: jsPDF } = await import("jspdf")

  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W    = doc.internal.pageSize.getWidth()   // 210 mm
  const H    = doc.internal.pageSize.getHeight()  // 297 mm
  const ML   = 22   // marge gauche
  const MR   = 22   // marge droite
  const TW   = W - ML - MR  // largeur utile = 166 mm

  const { employe, entreprise, dateEdition } = data
  const dirigeant = (entreprise.dirigeant || "La Direction") as string

  // ── LOGO ──────────────────────────────────────────────────────────────────
  try {
    const b64 = await loadImageAsBase64("/logo-sanovia.png")
    doc.addImage(b64, "PNG", ML, 8, 50, 12.2)
  } catch {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text("SANOVIA HEALTH CARE", ML, 18)
  }

  // Filet vert sous le logo
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.8)
  doc.line(0, 27, W, 27)

  // ── TITRE ─────────────────────────────────────────────────────────────────
  const titre = type === "TRAVAIL" ? "ATTESTATION DE TRAVAIL" : "ATTESTATION DE SALAIRE"
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(...NAVY)
  const tw  = doc.getTextWidth(titre)
  const tX  = (W - tw) / 2
  doc.text(titre, tX, 44)
  // Soulignement
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.45)
  doc.line(tX, 47, tX + tw, 47)

  // ── CORPS ─────────────────────────────────────────────────────────────────
  // Rendu ligne par ligne avec align "left" pour éviter toute justification jsPDF
  let y = 60
  const FS = 10.5  // taille corps

  function write(
    txt: string,
    options: { bold?: boolean; italic?: boolean; color?: [number,number,number]; size?: number } = {}
  ) {
    const sz  = options.size ?? FS
    const col = options.color ?? SLATE
    doc.setFont("helvetica", options.bold ? "bold" : options.italic ? "italic" : "normal")
    doc.setFontSize(sz)
    doc.setTextColor(...col)
    const lines = doc.splitTextToSize(txt, TW) as string[]
    lines.forEach(line => {
      doc.text(line, ML, y, { align: "left" })
      y += lh(sz)
    })
  }

  const skip = (mm = 5) => { y += mm }

  write(`Je soussigné(e), ${dirigeant}, représentant légal de la société ${entreprise.nom},`)
  skip(3)
  write("atteste par la présente que :")
  skip(6)

  // ── BLOC EMPLOYÉ ──────────────────────────────────────────────────────────
  const FS_BOX  = 9.5
  const LH_BOX  = lh(FS_BOX)
  const PAD     = 5   // padding interne (mm)

  const posteLabel = `Poste : ${employe.poste}${employe.departement ? `  —  ${employe.departement}` : ""}`
  const contratLabel = `Contrat : ${employe.typeContrat}   |   Depuis le : ${employe.dateEmbauche}`

  doc.setFont("helvetica", "normal")
  doc.setFontSize(FS_BOX)
  const posteLines   = doc.splitTextToSize(posteLabel,   TW - PAD * 2) as string[]
  const contratLines = doc.splitTextToSize(contratLabel, TW - PAD * 2) as string[]

  // Hauteur dynamique de la boîte
  const rowsInBox = 1              // nom
    + 1                            // matricule
    + posteLines.length
    + contratLines.length
    + (type === "TRAVAIL" ? 1 : 0) // ancienneté
  const boxH = PAD + LH_BOX * 1.6 + LH_BOX * (rowsInBox - 1) + PAD + 1

  doc.setFillColor(243, 249, 231)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, y, TW, boxH, 2, 2, "FD")

  let by = y + PAD + LH_BOX

  // Nom (gras, navy)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(FS_BOX + 0.5)
  doc.setTextColor(...NAVY)
  doc.text(`${employe.prenom.toUpperCase()} ${employe.nom.toUpperCase()}`, ML + PAD, by, { align: "left" })
  by += LH_BOX * 1.4

  // Matricule
  doc.setFont("helvetica", "normal")
  doc.setFontSize(FS_BOX)
  doc.setTextColor(...SLATE)
  doc.text(`Matricule : ${employe.matricule}`, ML + PAD, by, { align: "left" })
  by += LH_BOX

  // Poste (peut passer sur plusieurs lignes)
  posteLines.forEach(line => {
    doc.text(line, ML + PAD, by, { align: "left" })
    by += LH_BOX
  })

  // Contrat
  contratLines.forEach(line => {
    doc.text(line, ML + PAD, by, { align: "left" })
    by += LH_BOX
  })

  // Ancienneté (seulement attestation de travail)
  if (type === "TRAVAIL") {
    doc.text(`Ancienneté : ${employe.anciennete}`, ML + PAD, by, { align: "left" })
  }

  y += boxH + 8

  // ── PARAGRAPHES MÉTIER ────────────────────────────────────────────────────
  if (type === "TRAVAIL") {
    write(
      `est employé(e) au sein de notre organisation en qualité de ${employe.poste}` +
      `${employe.departement ? `, département ${employe.departement}` : ""}` +
      `, dans le cadre d'un contrat de type ${employe.typeContrat}.`
    )
    skip(5)
    write("À la date d'émission du présent document, l'intéressé(e) est toujours en poste.")
  } else {
    write(`perçoit un salaire brut mensuel de base de ${montant(employe.salaireBase)} FCFA.`)
    if (employe.derSalaire) {
      skip(5)
      write(
        `Son dernier salaire net perçu (${employe.derSalaire.mois} ${employe.derSalaire.annee})` +
        ` s'élève à ${montant(employe.derSalaire.netAPayer)} FCFA.`
      )
    }
  }

  skip(8)
  write("La présente attestation est délivrée à l'intéressé(e) pour faire valoir ce que de droit.", { italic: true })

  // ── ZONE SIGNATURE ────────────────────────────────────────────────────────
  skip(20)

  // Gauche : Fait à
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...GRAY)
  doc.text(`Fait à _______________, le ${dateEdition}`, ML, y, { align: "left" })

  // Droite : bloc signature
  const SX = W - MR
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...NAVY)
  doc.text("Signature et cachet :", SX, y, { align: "right" })

  y += lh(9.5) + 2
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...SLATE)
  doc.text(dirigeant, SX, y, { align: "right" })

  y += lh(9)
  doc.setFont("helvetica", "italic")
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text("Représentant légal", SX, y, { align: "right" })

  // Ligne pour la signature de l'employé
  const lineY = y + 20
  doc.setDrawColor(200, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(W / 2 + 4, lineY, W - MR, lineY)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text("Date et signature", W / 2 + 4, lineY + 4, { align: "left" })

  // ── PIED DE PAGE ──────────────────────────────────────────────────────────
  const FOOT_H = 18
  doc.setFillColor(...NAVY)
  doc.rect(0, H - FOOT_H, W, FOOT_H, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text("SANOVIA Health Care", W / 2, H - FOOT_H + 5.5, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.text(
    "Tel : 656 67 67 67  —  670 44 55 68   |   shcdg@sanoviahc.com   |   Societe a responsabilite limitee",
    W / 2, H - FOOT_H + 10.5, { align: "center" }
  )
  doc.text(
    "NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
    W / 2, H - FOOT_H + 15, { align: "center" }
  )

  const filename = `attestation_${type.toLowerCase()}_${employe.nom.toLowerCase()}_${employe.prenom.toLowerCase()}.pdf`
  doc.save(filename)
}

export function AttestationButtons({ employeId }: { employeId: string }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  async function handle(type: "TRAVAIL" | "SALAIRE") {
    setLoading(type); setOpen(false)
    await genererAttestation(employeId, type)
    setLoading(null)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        Attestations
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            <button
              onClick={() => handle("TRAVAIL")}
              className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-blue-500" />
              Attestation de travail
            </button>
            <button
              onClick={() => handle("SALAIRE")}
              className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 border-t border-slate-50">
              <FileText className="h-4 w-4 text-emerald-500" />
              Attestation de salaire
            </button>
          </div>
        </>
      )}
    </div>
  )
}
