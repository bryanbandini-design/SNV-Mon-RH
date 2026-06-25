"use client"

import { useState } from "react"
import { FileText, Loader2, ChevronDown } from "lucide-react"

async function genererAttestation(employeId: string, type: "TRAVAIL" | "SALAIRE") {
  const res = await fetch(`/api/documents/attestation?employeId=${employeId}&type=${type}`)
  if (!res.ok) return

  const data = await res.json()
  const { default: jsPDF } = await import("jspdf")

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const w   = doc.internal.pageSize.getWidth()
  const DARK = [15, 23, 42] as [number, number, number]
  const GRAY = [100, 116, 139] as [number, number, number]

  // En-tête entreprise
  doc.setFillColor(...DARK)
  doc.rect(0, 0, w, 40, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(data.entreprise.nom, 20, 18)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  if (data.entreprise.adresse) doc.text(data.entreprise.adresse, 20, 25)
  const identLine = [data.entreprise.rccm && `RCCM : ${data.entreprise.rccm}`, data.entreprise.niu && `NIU : ${data.entreprise.niu}`].filter(Boolean).join("  |  ")
  if (identLine) doc.text(identLine, 20, 31)

  // Titre attestation
  const titre = type === "TRAVAIL" ? "ATTESTATION DE TRAVAIL" : "ATTESTATION DE SALAIRE"
  doc.setTextColor(...DARK)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  const tw = doc.getTextWidth(titre)
  doc.text(titre, (w - tw) / 2, 62)

  // Ligne décorative
  doc.setDrawColor(99, 102, 241)
  doc.setLineWidth(0.8)
  doc.line(20, 66, w - 20, 66)

  // Corps
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...DARK)

  const { employe, entreprise, dateEdition } = data
  const dirigeant = entreprise.dirigeant || "La Direction"

  let y = 82
  const ligne = (txt: string) => {
    const lines = doc.splitTextToSize(txt, w - 40)
    doc.text(lines, 20, y)
    y += lines.length * 7
  }
  const saut = (h = 5) => { y += h }

  ligne(`Je soussigné(e), ${dirigeant}, représentant légal de la société ${entreprise.nom},`)
  saut()
  ligne(`atteste que Monsieur / Madame ${employe.prenom} ${employe.nom}, matricule ${employe.matricule},`)
  saut()

  if (type === "TRAVAIL") {
    ligne(`est employé(e) au sein de notre société en qualité de ${employe.poste}${employe.departement ? `, au sein du département ${employe.departement}` : ""},`)
    saut()
    ligne(`dans le cadre d'un contrat de travail de type ${employe.typeContrat}, depuis le ${employe.dateEmbauche}.`)
    saut()
    ligne(`À la date d'établissement du présent document, Monsieur / Madame ${employe.nom} occupe toujours ce poste avec une ancienneté de ${employe.anciennete}.`)
  } else {
    ligne(`est employé(e) en qualité de ${employe.poste}, depuis le ${employe.dateEmbauche}.`)
    saut()
    const net = employe.salaireBase.toLocaleString("fr-FR") + " FCFA"
    ligne(`Son salaire mensuel brut de base est de ${net}.`)
    saut()
    if (employe.derSalaire) {
      const netP = employe.derSalaire.netAPayer.toLocaleString("fr-FR") + " FCFA"
      ligne(`Son dernier salaire net perçu (${employe.derSalaire.mois} ${employe.derSalaire.annee}) s'élève à ${netP}.`)
    }
  }

  saut(10)
  ligne("La présente attestation est délivrée à l'intéressé(e) pour faire valoir ce que de droit.")
  saut(16)

  // Signature
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text(`Fait à __________, le ${dateEdition}`, 20, y)
  y += 8
  doc.setTextColor(...DARK)
  doc.setFont("helvetica", "bold")
  doc.text(dirigeant, w - 20 - doc.getTextWidth(dirigeant), y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.text("Signature et cachet", w - 20 - doc.getTextWidth("Signature et cachet"), y)

  // Footer
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(20, 275, w - 20, 275)
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  const footer = `Document généré le ${dateEdition} — ${entreprise.nom}`
  doc.text(footer, (w - doc.getTextWidth(footer)) / 2, 281)

  const filename = `attestation_${type.toLowerCase()}_${employe.nom}_${employe.prenom}.pdf`
  doc.save(filename)
}

export function AttestationButtons({ employeId }: { employeId: string }) {
  const [open, setOpen]     = useState(false)
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
            <button onClick={() => handle("TRAVAIL")} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-blue-500" />
              Attestation de travail
            </button>
            <button onClick={() => handle("SALAIRE")} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 border-t border-slate-50">
              <FileText className="h-4 w-4 text-emerald-500" />
              Attestation de salaire
            </button>
          </div>
        </>
      )}
    </div>
  )
}
