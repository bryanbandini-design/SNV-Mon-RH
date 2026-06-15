"use client"

import { useState, useEffect } from "react"
import { DollarSign, Download, Loader2 } from "lucide-react"
import { formatCurrency, MOIS } from "@/lib/utils"
import { toast } from "sonner"

type Employe = { prenom: string; nom: string; matricule: string; poste: string; salaireBase: number }
type Salaire = {
  id: string; mois: number; annee: number
  salaireBase: number; primes: number; retenues: number; netAPayer: number
  statut: string; datePaiement: string | null; notes: string | null
}

async function genererPDF(salaire: Salaire, employe: Employe) {
  const { jsPDF } = await import("jspdf")
  const autoTable  = (await import("jspdf-autotable")).default

  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const blue = [37, 99, 235] as [number, number, number]
  const dark = [15, 23, 42]  as [number, number, number]
  const grey = [100, 116, 139] as [number, number, number]

  // Header bande colorée
  doc.setFillColor(...blue)
  doc.rect(0, 0, 210, 40, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("BULLETIN DE PAIE", 14, 16)

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(`${MOIS[salaire.mois - 1]} ${salaire.annee}`, 14, 25)

  doc.setFontSize(9)
  doc.text(`Matricule : ${employe.matricule}`, 14, 33)

  // Infos employé
  doc.setTextColor(...dark)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.text(`${employe.prenom} ${employe.nom}`, 14, 52)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...grey)
  doc.text(employe.poste, 14, 58)

  // Table détails
  autoTable(doc, {
    startY: 68,
    head: [["Libellé", "Base", "Montant"]],
    body: [
      ["Salaire de base",       "",   formatCurrency(salaire.salaireBase)],
      ["Primes & avantages",    "+",  formatCurrency(salaire.primes)],
      ["Retenues & charges",    "-",  formatCurrency(salaire.retenues)],
    ],
    headStyles:   { fillColor: blue, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles:   { fontSize: 10, textColor: dark },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 20, halign: "center" }, 2: { halign: "right" } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Net à payer en évidence
  doc.setFillColor(236, 253, 245)
  doc.roundedRect(14, afterTable, 182, 18, 3, 3, "F")
  doc.setTextColor(5, 150, 105)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("NET À PAYER", 20, afterTable + 11)
  doc.setFontSize(14)
  doc.text(formatCurrency(salaire.netAPayer), 196, afterTable + 11, { align: "right" })

  // Statut paiement
  if (salaire.statut === "PAYE" && salaire.datePaiement) {
    doc.setTextColor(...grey)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Payé le ${new Date(salaire.datePaiement).toLocaleDateString("fr-FR")}`,
      14, afterTable + 30
    )
  }

  // Notes
  if (salaire.notes) {
    doc.setTextColor(...grey)
    doc.setFontSize(8)
    doc.text(`Note : ${salaire.notes}`, 14, afterTable + 38)
  }

  // Footer
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 277, 210, 20, "F")
  doc.setTextColor(...grey)
  doc.setFontSize(7)
  doc.text("Document généré automatiquement — Mon RH", 105, 285, { align: "center" })
  doc.text(`Émis le ${new Date().toLocaleDateString("fr-FR")}`, 105, 290, { align: "center" })

  doc.save(`bulletin-${MOIS[salaire.mois - 1]}-${salaire.annee}-${employe.nom}.pdf`)
}

export default function MesSalairesPage() {
  const [employe,  setEmploye]  = useState<Employe | null>(null)
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/mon-espace/salaires")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setEmploye(data.employe); setSalaires(data.salaires) }
      })
  }, [])

  async function handleDownload(s: Salaire) {
    if (!employe) return
    setLoadingId(s.id)
    try {
      await genererPDF(s, employe)
      toast.success("Bulletin téléchargé !")
    } catch {
      toast.error("Erreur lors de la génération du PDF")
    }
    setLoadingId(null)
  }

  const totalPaye = salaires.filter(s => s.statut === "PAYE").reduce((a, s) => a + s.netAPayer, 0)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes salaires</h1>
        <p className="text-sm text-slate-500 mt-1">Historique et téléchargement de vos bulletins de paie</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Salaire de base",  value: employe ? formatCurrency(employe.salaireBase) : "—", color: "text-slate-900" },
          { label: "Total perçu",      value: formatCurrency(totalPaye),                             color: "text-emerald-700" },
          { label: "Bulletins",        value: `${salaires.length} mois`,                             color: "text-slate-700" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Liste des bulletins */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Bulletins de paie</p>
        </div>
        {salaires.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucun bulletin disponible</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {salaires.map(s => {
              const ajust = s.primes - s.retenues
              return (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{MOIS[s.mois - 1]} {s.annee}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Base {formatCurrency(s.salaireBase)}
                      {ajust !== 0 && (
                        <span style={{ color: ajust > 0 ? "#10b981" : "#ef4444" }}>
                          {" "}{ajust > 0 ? "+" : ""}{formatCurrency(ajust)}
                        </span>
                      )}
                      {s.notes && <span className="italic text-slate-400"> · {s.notes}</span>}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-base font-black text-slate-900">{formatCurrency(s.netAPayer)}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>{s.statut === "PAYE" ? "Payé" : "En attente"}</span>
                  </div>
                  <button
                    onClick={() => handleDownload(s)}
                    disabled={loadingId === s.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-700 transition-all disabled:opacity-50 flex-shrink-0"
                  >
                    {loadingId === s.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />
                    }
                    PDF
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
