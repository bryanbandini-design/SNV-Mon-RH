"use client"

import { useState } from "react"
import { FileText, Loader2, ChevronDown } from "lucide-react"

// ── Palette SANOVIA ──────────────────────────────────────────────────────────
const NAVY  = [26,  52,  97] as [number,number,number]
const GREEN = [122,179,  46] as [number,number,number]
const BLUE  = [30, 139, 192] as [number,number,number]
const GRAY  = [100,116, 139] as [number,number,number]
const SLATE = [51,  65,  85] as [number,number,number]
const WHITE = 255

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

async function genererAttestation(employeId: string, type: "TRAVAIL" | "SALAIRE") {
  const res = await fetch(`/api/documents/attestation?employeId=${employeId}&type=${type}`)
  if (!res.ok) return

  const data = await res.json()
  const { default: jsPDF } = await import("jspdf")

  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const w    = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const m    = 20

  // ── Logo SANOVIA ──────────────────────────────────────────────────────────
  try {
    const b64 = await loadImageAsBase64("/logo-sanovia.png")
    doc.addImage(b64, "PNG", m, 7, 55, 13.4)
  } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(14)
    doc.setTextColor(...NAVY); doc.text("SANOVIA HEALTH CARE", m, 16)
  }

  // Ligne séparatrice verte sous le logo
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.8)
  doc.line(0, 26, w, 26)

  // ── Titre du document ─────────────────────────────────────────────────────
  const titre = type === "TRAVAIL" ? "ATTESTATION DE TRAVAIL" : "ATTESTATION DE SALAIRE"
  doc.setFont("helvetica", "bold"); doc.setFontSize(15)
  doc.setTextColor(...NAVY)
  const tw = doc.getTextWidth(titre)
  doc.text(titre, (w - tw) / 2, 42)

  // Ligne décorative verte sous le titre
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5)
  doc.line((w - tw) / 2, 45, (w + tw) / 2, 45)

  // ── Corps du document ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal"); doc.setFontSize(11)
  doc.setTextColor(...SLATE)

  const { employe, entreprise, dateEdition } = data
  const dirigeant = entreprise.dirigeant || "La Direction"

  let y = 60
  const ligne = (txt: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    const lines = doc.splitTextToSize(txt, w - m * 2)
    doc.text(lines, m, y)
    y += lines.length * 7
  }
  const saut = (h = 5) => { y += h }

  ligne(`Je soussigné(e), ${dirigeant}, représentant légal de la société ${entreprise.nom},`)
  saut()
  ligne(`atteste par la présente que :`)
  saut(3)

  // Bloc info salarié encadré
  doc.setFillColor(242, 248, 230)  // vert très pâle
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.4)
  doc.roundedRect(m, y - 3, w - m * 2, type === "TRAVAIL" ? 32 : 26, 2, 2, "FD")
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY)
  doc.text(`${employe.prenom.toUpperCase()} ${employe.nom.toUpperCase()}`, m + 4, y + 5)
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...SLATE)
  doc.text(`Matricule : ${employe.matricule}`, m + 4, y + 12)
  doc.text(`Poste : ${employe.poste}${employe.departement ? `  —  ${employe.departement}` : ""}`, m + 4, y + 19)
  doc.text(`Contrat : ${employe.typeContrat}  |  Depuis le : ${employe.dateEmbauche}`, m + 4, y + 26)
  if (type === "TRAVAIL") {
    doc.text(`Ancienneté : ${employe.anciennete}`, m + 4, y + 33)
    y += 40
  } else {
    y += 33
  }
  saut(8)

  doc.setFontSize(11); doc.setTextColor(...SLATE)
  if (type === "TRAVAIL") {
    ligne(`est employé(e) au sein de notre organisation en qualité de ${employe.poste}${employe.departement ? `, département ${employe.departement}` : ""}, dans le cadre d'un contrat de type ${employe.typeContrat}.`)
    saut()
    ligne(`À la date d'émission du présent document, l'intéressé(e) est toujours en poste.`)
  } else {
    const brut = employe.salaireBase.toLocaleString("fr-FR") + " FCFA"
    ligne(`perçoit un salaire brut mensuel de base de ${brut}.`)
    saut()
    if (employe.derSalaire) {
      const netP = employe.derSalaire.netAPayer.toLocaleString("fr-FR") + " FCFA"
      ligne(`Son dernier salaire net perçu (${employe.derSalaire.mois} ${employe.derSalaire.annee}) s'élève à ${netP}.`)
    }
  }

  saut(10)
  doc.setFont("helvetica", "italic"); doc.setFontSize(11); doc.setTextColor(...SLATE)
  ligne("La présente attestation est délivrée à l'intéressé(e) pour faire valoir ce que de droit.")

  // ── Signature ─────────────────────────────────────────────────────────────
  saut(18)
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GRAY)
  doc.text(`Fait à __________, le ${dateEdition}`, m, y)

  const sigX = w - m
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY)
  const sigLabel = "Signature et cachet :"
  doc.text(sigLabel, sigX - doc.getTextWidth(sigLabel), y)
  y += 6
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...SLATE)
  doc.text(dirigeant, sigX - doc.getTextWidth(dirigeant), y)
  y += 4
  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...GRAY)
  doc.text("Représentant légal", sigX - doc.getTextWidth("Représentant légal"), y)

  // Ligne signature employeur
  doc.setDrawColor(203,213,225); doc.setLineWidth(0.3)
  doc.line(w / 2 + 4, y + 14, w - m, y + 14)
  doc.setFontSize(8); doc.setTextColor(...GRAY)
  doc.text("Date et signature", w / 2 + 4, y + 18)

  // ── Pied de page SANOVIA ──────────────────────────────────────────────────
  const footH = 18
  doc.setFillColor(...NAVY)
  doc.rect(0, pageH - footH, w, footH, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(WHITE, WHITE, WHITE)
  doc.text("SANOVIA Health Care", w / 2, pageH - footH + 5, { align: "center" })
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.8)
  doc.text(
    "Tél : 656 67 67 67 — 670 44 55 68   |   shcdg@sanoviahc.com   |   Société à responsabilité limitée",
    w / 2, pageH - footH + 10, { align: "center" }
  )
  doc.text(
    "NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
    w / 2, pageH - footH + 15, { align: "center" }
  )

  const filename = `attestation_${type.toLowerCase()}_${employe.nom}_${employe.prenom}.pdf`
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
