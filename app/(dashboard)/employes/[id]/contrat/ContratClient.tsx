"use client"

import { useState } from "react"
import { FileText, Download, ArrowLeft } from "lucide-react"
import Link from "next/link"
import jsPDF from "jspdf"
import { formatCurrency, MOIS } from "@/lib/utils"
import { toast } from "sonner"

type Employe = {
  id: string; prenom: string; nom: string; matricule: string; poste: string
  departement: string | null; typeContrat: string
  dateEmbauche: string; dateFinContrat: string | null; salaireBase: number
  adresse: string | null; nationalite: string | null; numeroCni: string | null
  periodeEssai: boolean; dateDebutEssai: string | null; dateFinEssai: string | null
}
type Entreprise = { nom: string; adresse: string; rccm: string; niu: string; tel: string; email: string; dirigeant: string }

function fmt(d: string | null) {
  if (!d) return "___________"
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

const NAVY = [26, 52, 97] as [number, number, number]
const GREEN = [122, 179, 46] as [number, number, number]

export function ContratClient({ employe, entreprise }: { employe: Employe; entreprise: Entreprise }) {
  const [generating, setGenerating] = useState(false)
  const isCDD = employe.typeContrat === "CDD"

  async function generateContrat() {
    setGenerating(true)
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" })
      const W = 210, m = 20, cw = W - 2 * m
      let y = m

      // Logo
      try {
        const res = await fetch("/logo-sanovia.png")
        const blob = await res.blob()
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        doc.addImage(b64, "PNG", m, y, 40, 14)
      } catch { /* logo non disponible */ }

      // En-tête entreprise
      doc.setFontSize(8); doc.setTextColor(80, 80, 80)
      doc.setFont("helvetica", "normal")
      doc.text([
        entreprise.nom, entreprise.adresse,
        `NIU : ${entreprise.niu}  ·  RCCM : ${entreprise.rccm}`,
        `Tél : ${entreprise.tel}  ·  ${entreprise.email}`,
      ], W - m, y + 2, { align: "right" })

      // Ligne de séparation verte
      y += 18
      doc.setDrawColor(...GREEN); doc.setLineWidth(0.8)
      doc.line(m, y, W - m, y)
      y += 8

      // Titre contrat
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY)
      const titre = isCDD
        ? "CONTRAT À DURÉE DÉTERMINÉE"
        : employe.typeContrat === "STAGE" ? "CONVENTION DE STAGE" : "CONTRAT À DURÉE INDÉTERMINÉE"
      doc.text(titre, W / 2, y, { align: "center" })
      y += 6
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100)
      doc.text(`Matricule : ${employe.matricule}`, W / 2, y, { align: "center" })
      y += 10

      // Section Entre les soussignés
      const addSection = (titre: string) => {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY)
        doc.setFillColor(...NAVY); doc.rect(m, y - 4, cw, 7, "F")
        doc.setTextColor(255, 255, 255); doc.text(titre.toUpperCase(), m + 3, y)
        doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal"); doc.setFontSize(9)
        y += 5
      }

      const addLine = (text: string, indent = 0) => {
        const lines = doc.splitTextToSize(text, cw - indent)
        doc.text(lines, m + indent, y)
        y += lines.length * 5 + 1
      }

      addSection("Entre les soussignés")
      y += 3
      addLine(`La société ${entreprise.nom.toUpperCase()}, immatriculée au RCCM sous le numéro ${entreprise.rccm || "___________"}, NIU ${entreprise.niu || "___________"}, dont le siège social est à ${entreprise.adresse || "___________"}, représentée par ${entreprise.dirigeant || "le(la) Directeur(rice) Général(e)"},`)
      addLine("ci-après dénommée « l'Employeur »,", 5)
      y += 2
      addLine(`Et Monsieur/Madame ${employe.prenom.toUpperCase()} ${employe.nom.toUpperCase()}, de nationalité ${employe.nationalite || "camerounaise"}, ${employe.numeroCni ? `porteur(euse) de la CNI N° ${employe.numeroCni}` : "dont l'identité a été vérifiée"}, demeurant à ${employe.adresse || "___________"},`)
      addLine("ci-après dénommé(e) « le Salarié »,", 5)
      y += 4

      addSection("Il a été convenu et arrêté ce qui suit")
      y += 3
      addLine(`Art. 1 — ENGAGEMENT. L'Employeur engage le Salarié à compter du ${fmt(employe.dateEmbauche)} en qualité de ${employe.poste}${employe.departement ? `, au sein du département ${employe.departement}` : ""}.`)
      y += 2
      if (isCDD) {
        addLine(`Art. 2 — DURÉE. Le présent contrat est conclu pour une durée déterminée du ${fmt(employe.dateEmbauche)} au ${fmt(employe.dateFinContrat)}.`)
      } else {
        addLine("Art. 2 — DURÉE. Le présent contrat est conclu pour une durée indéterminée.")
      }
      y += 2
      if (employe.periodeEssai && employe.dateDebutEssai) {
        addLine(`Art. 3 — PÉRIODE D'ESSAI. Le Salarié est soumis à une période d'essai du ${fmt(employe.dateDebutEssai)} au ${fmt(employe.dateFinEssai)}, renouvelable une fois selon les dispositions du Code du Travail camerounais.`)
        y += 2
      }
      addLine(`Art. ${employe.periodeEssai ? "4" : "3"} — RÉMUNÉRATION. Le Salarié percevra une rémunération mensuelle brute de ${formatCurrency(employe.salaireBase)} (${employe.salaireBase.toLocaleString("fr-FR")} FCFA), soumise aux cotisations obligatoires selon la législation en vigueur (CNPS, IRPP, CAC, RAV).`)
      y += 2
      addLine(`Art. ${employe.periodeEssai ? "5" : "4"} — DURÉE DU TRAVAIL. La durée hebdomadaire de travail est fixée à 40 heures conformément à l'article 80 du Code du Travail camerounais. Toute heure effectuée au-delà de cette durée sera rémunérée conformément aux dispositions légales.`)
      y += 2
      addLine(`Art. ${employe.periodeEssai ? "6" : "5"} — CONGÉS PAYÉS. Le Salarié bénéficie de 2,5 jours ouvrables de congés payés par mois de travail effectif, conformément à l'article 89 du Code du Travail camerounais.`)
      y += 2
      addLine(`Art. ${employe.periodeEssai ? "7" : "6"} — CONFIDENTIALITÉ. Le Salarié s'engage à respecter la confidentialité des informations auxquelles il a accès dans le cadre de ses fonctions.`)
      y += 2
      addLine(`Art. ${employe.periodeEssai ? "8" : "7"} — DROIT APPLICABLE. Le présent contrat est régi par le Code du Travail camerounais (Loi N° 92/007 du 14 août 1992) et ses textes d'application.`)
      y += 8

      // Signatures
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY)
      doc.text("Fait à Yaoundé, le ___________________", m, y)
      y += 8
      doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30)
      doc.text("Pour l'Employeur", m, y)
      doc.text("Le Salarié", W / 2 + 10, y)
      y += 4
      doc.text("(Signature et cachet)", m, y)
      doc.text("(Signature précédée de la mention « Lu et approuvé »)", W / 2 + 10, y)
      y += 20
      doc.text(entreprise.dirigeant || "Directeur Général", m, y)
      doc.text(`${employe.prenom} ${employe.nom.toUpperCase()}`, W / 2 + 10, y)

      // Pied de page
      doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "italic")
      doc.text(`Document généré par Mon RH — ${entreprise.nom} · ${new Date().toLocaleDateString("fr-FR")}`, W / 2, 285, { align: "center" })

      doc.save(`Contrat_${employe.typeContrat}_${employe.nom}_${employe.prenom}.pdf`)
      toast.success("Contrat généré avec succès")
    } catch (err) {
      console.error(err)
      toast.error("Erreur lors de la génération du contrat")
    }
    setGenerating(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/employes/${employe.id}`} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Générer un contrat</h1>
          <p className="text-sm text-slate-500">{employe.prenom} {employe.nom} — {employe.typeContrat}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#eff6ff" }}>
            <FileText className="h-5 w-5" style={{ color: "#1a3461" }} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{isCDD ? "Contrat à Durée Déterminée" : employe.typeContrat === "STAGE" ? "Convention de Stage" : "Contrat à Durée Indéterminée"}</p>
            <p className="text-xs text-slate-500">Conforme au Code du Travail camerounais — Loi N° 92/007</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Employé",        value: `${employe.prenom} ${employe.nom}` },
            { label: "Poste",          value: employe.poste },
            { label: "Type de contrat", value: employe.typeContrat },
            { label: "Date d'embauche", value: fmt(employe.dateEmbauche) },
            ...(isCDD ? [{ label: "Date de fin", value: fmt(employe.dateFinContrat) }] : []),
            { label: "Salaire brut",   value: formatCurrency(employe.salaireBase) },
          ].map(r => (
            <div key={r.label} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-400">{r.label}</p>
              <p className="font-semibold text-slate-900 mt-0.5">{r.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Le contrat inclut : clauses légales obligatoires, période d'essai{employe.periodeEssai ? " (mentionnée)" : ""}, rémunération, durée du travail (40h/sem.), congés payés (2,5j/mois), confidentialité et bloc de signature.
        </div>

        <div className="flex justify-end">
          <button onClick={generateContrat} disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg, #1a3461, #1e8bc0)" }}>
            {generating ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {generating ? "Génération…" : "Générer le contrat PDF"}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Document à faire signer en deux exemplaires originaux — un pour l'employeur, un pour le salarié.
      </p>
    </div>
  )
}
