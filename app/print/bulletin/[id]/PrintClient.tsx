"use client"

import { useState, useEffect } from "react"
import { type DetailsSalaire, CAMEROUN } from "@/lib/cameroun-salaire"

function n(v: number, decimals = 0) {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fcfa(v: number) { return n(v) + " FCFA" }

type Entreprise = { nom: string; adresse: string; rccm: string; niu: string; tel: string; email: string; dirigeant: string }

type Props = {
  moisLib:      string
  annee:        number
  isPaye:       boolean
  datePaiement: string | null
  notes:        string | null
  employe: { prenom: string; nom: string; matricule: string; poste: string; departement?: string; dateEmbauche: string; typeContrat: string }
  entreprise:   Entreprise
  salaireBase:  number
  primes:       number
  retenues:     number
  calc:         DetailsSalaire
  baseCNPS:     number
  genereLe:     string
}

// Couleur du bandeau pied de page SANOVIA
const SANOVIA_NAVY = "#1a3461"

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

export default function PrintClient(props: Props) {
  const { moisLib, annee, isPaye, datePaiement, notes, employe, entreprise, salaireBase, primes, retenues, calc, baseCNPS, genereLe } = props

  const [platform, setPlatform] = useState<"android" | "ios" | "web">("web")
  const [sharing,  setSharing]  = useState(false)

  useEffect(() => {
    const p = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
    if (p === "android" || p === "ios") setPlatform(p)
  }, [])

  const isMobile = platform === "android" || platform === "ios"

  // ── Génération PDF (mobile uniquement) ───────────────────────────────────
  async function partagerPDF() {
    setSharing(true)
    try {
      const { jsPDF }     = await import("jspdf")
      const { autoTable } = await import("jspdf-autotable")

      const doc   = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const m     = 12

      // ── Logo SANOVIA en haut à gauche ─────────────────────────────────────
      try {
        const logoBase64 = await loadImageAsBase64("/logo-sanovia.png")
        // Largeur 55mm, hauteur proportionnelle (logo 1765×431 → ratio ~4.09:1 → 55/4.09≈13.4mm)
        doc.addImage(logoBase64, "PNG", m, 6, 55, 13.4)
      } catch {
        // Si le logo ne charge pas : nom en texte
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(26, 52, 97)
        doc.text("SANOVIA HEALTH CARE", m, 14)
      }

      // Ligne séparatrice sous le logo
      doc.setDrawColor(230, 235, 245)
      doc.line(0, 24, pageW, 24)

      // ── Identité employé + titre ──────────────────────────────────────────
      const col2 = pageW / 2

      // Titre central
      doc.setFillColor(15, 23, 42)
      doc.rect(col2 - 30, 27, 60, 12, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
      doc.text("BULLETIN DE PAIE", col2, 33.5, { align: "center" })
      doc.setFont("helvetica", "normal"); doc.setFontSize(8)
      doc.text(`${moisLib.toUpperCase()} ${annee}`, col2, 37.5, { align: "center" })

      // Bloc employeur (info légale, côté gauche)
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42)
      doc.text("EMPLOYEUR", m, 30)
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105)
      let yE = 35
      if (entreprise.rccm)    { doc.text(`RCCM : ${entreprise.rccm}`, m, yE); yE += 4.5 }
      if (entreprise.niu)     { doc.text(`NIU : ${entreprise.niu}`, m, yE); yE += 4.5 }
      if (entreprise.adresse) { doc.text(entreprise.adresse, m, yE) }

      // Bloc salarié (côté droit)
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42)
      doc.text("SALARIÉ", col2 + 35, 30)
      doc.setFont("helvetica", "bold"); doc.setFontSize(9)
      doc.text(`${employe.prenom.toUpperCase()} ${employe.nom.toUpperCase()}`, col2 + 35, 35)
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105)
      doc.text(`Matricule : ${employe.matricule}`, col2 + 35, 39.5)
      doc.text(`Emploi : ${employe.poste}`, col2 + 35, 44)
      if (employe.departement) doc.text(`Dép. : ${employe.departement}`, col2 + 35, 48.5)
      doc.text(`Contrat : ${employe.typeContrat}`, col2 + 35, employe.departement ? 53 : 48.5)

      // Bande période
      doc.setFillColor(30, 41, 59)
      doc.rect(0, 56, pageW, 9, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
      doc.text(`PÉRIODE : ${moisLib.toUpperCase()} ${annee}`, m, 62)
      const statutTxt = isPaye ? `PAYÉ le ${datePaiement ?? ""}` : "EN ATTENTE DE PAIEMENT"
      doc.setFont("helvetica", "normal")
      doc.text(statutTxt, pageW - m, 62, { align: "right" })

      // ── Table principale ─────────────────────────────────────────────────
      const rows: (string | { content: string; styles?: object })[][] = []

      rows.push([
        { content: "1000", styles: { fontStyle: "bold" } },
        { content: "Salaire de base", styles: { fontStyle: "bold" } },
        { content: n(salaireBase), styles: { halign: "right" } },
        "",
        { content: n(salaireBase), styles: { halign: "right", textColor: [5, 100, 5] } },
        "",
      ])
      if (primes > 0) rows.push([
        "1001",
        "Primes et avantages divers",
        "",
        "",
        { content: n(primes), styles: { halign: "right", textColor: [5, 100, 5] } },
        "",
      ])
      rows.push([
        "3000",
        `CNPS — Vieillesse / Invalidité / Décès (plaf. ${n(CAMEROUN.CNPS_PLAFOND_MENSUEL)} F)`,
        { content: n(baseCNPS), styles: { halign: "right" } },
        "4,20 %",
        "",
        { content: n(calc.cnpsSalarie), styles: { halign: "right", textColor: [180, 20, 20] } },
      ])
      rows.push([
        "",
        "  Revenu net imposable (brut − CNPS)",
        { content: n(calc.revenuNetImposable), styles: { halign: "right", textColor: [100, 116, 139] } },
        "",
        "",
        "",
      ])
      rows.push([
        "3001",
        "Abattement forfaitaire (30 %, max 25 000 FCFA)",
        { content: n(calc.revenuNetImposable), styles: { halign: "right" } },
        "30 %",
        "",
        { content: n(calc.abattement), styles: { halign: "right", textColor: [180, 20, 20] } },
      ])
      rows.push([
        "3002",
        "IRPP — Impôt sur le Revenu des Personnes Physiques",
        { content: n(calc.baseIRPP), styles: { halign: "right" } },
        "Progressif",
        "",
        { content: n(calc.irpp), styles: { halign: "right", textColor: [180, 20, 20] } },
      ])
      rows.push([
        "3003",
        "CAC — Centimes Additionnels Communaux",
        { content: n(calc.irpp), styles: { halign: "right" } },
        "10 %",
        "",
        { content: n(calc.cac), styles: { halign: "right", textColor: [180, 20, 20] } },
      ])
      rows.push([
        "3004",
        "RAV — Redevance Audiovisuelle",
        "",
        "Forfait",
        "",
        { content: n(calc.rav), styles: { halign: "right", textColor: [180, 20, 20] } },
      ])
      if (retenues > 0) rows.push([
        "3005",
        "Autres retenues (avances, absences…)",
        "",
        "",
        "",
        { content: n(retenues), styles: { halign: "right", textColor: [180, 20, 20] } },
      ])
      rows.push([
        { content: "", styles: { fillColor: [241, 245, 249] } },
        { content: "TOTAL BRUT", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: "", styles: { fillColor: [241, 245, 249] } },
        { content: "", styles: { fillColor: [241, 245, 249] } },
        { content: n(calc.brutImposable), styles: { halign: "right", fontStyle: "bold", fillColor: [220, 252, 231], textColor: [5, 100, 5] } },
        { content: n(calc.totalRetenues), styles: { halign: "right", fontStyle: "bold", fillColor: [254, 226, 226], textColor: [180, 20, 20] } },
      ])

      autoTable(doc, {
        startY: 68,
        head: [["Code", "Libellé", "Base (FCFA)", "Taux", "Gains (FCFA)", "Retenues (FCFA)"]],
        body: rows,
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 13, halign: "center", textColor: [100, 116, 139] },
          1: { cellWidth: "auto" },
          2: { cellWidth: 26, halign: "right" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 26, halign: "right" },
          5: { cellWidth: 26, halign: "right" },
        },
        margin: { left: m, right: m },
      })

      const yNet = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 180

      doc.setFillColor(15, 23, 42)
      doc.rect(m, yNet + 2, pageW - m * 2, 14, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
      doc.text("NET À PAYER", m + 4, yNet + 10.5)
      doc.setFontSize(13); doc.setTextColor(52, 211, 153)
      doc.text(fcfa(calc.netAPayer), pageW - m - 4, yNet + 10.5, { align: "right" })

      // Charges patronales
      const yPat = yNet + 20
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105)
      doc.text("CHARGES PATRONALES — informatif (non déduites du salaire)", m, yPat)
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139)
      const patRow = [
        `Vieillesse 3,70 % -> ${n(Math.round(baseCNPS * CAMEROUN.CNPS_VIEILLESSE_PAT))} FCFA`,
        `Alloc. Familiales 7,00 % -> ${n(Math.round(baseCNPS * CAMEROUN.CNPS_ALLOC_FAM_PAT))} FCFA`,
        `AT/MP 2,50 % -> ${n(Math.round(baseCNPS * CAMEROUN.CNPS_AT_MP_PAT))} FCFA`,
        `Total 13,20 % -> ${n(calc.cnpsPatronal)} FCFA`,
        `Cout total employeur -> ${n(calc.coutTotal)} FCFA`,
      ].join("   |   ")
      doc.text(patRow, m, yPat + 5, { maxWidth: pageW - m * 2 })

      if (notes) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
        doc.text(`Observations : ${notes}`, m, yPat + 14)
      }

      // Signatures
      const ySig = pageH - 52
      doc.setDrawColor(203, 213, 225)
      doc.line(m, ySig, pageW - m, ySig)
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105)
      doc.text("Signature et cachet de l'employeur :", m, ySig + 6)
      doc.text("Signature du salarie (lu et approuve) :", col2 + 4, ySig + 6)
      doc.text("Recu la somme de :", col2 + 4, ySig + 12)
      doc.setFont("helvetica", "italic")
      doc.text(fcfa(calc.netAPayer), col2 + 4, ySig + 18)
      doc.setDrawColor(203, 213, 225)
      doc.line(m, ySig + 28, m + 75, ySig + 28)
      doc.line(col2 + 4, ySig + 28, col2 + 79, ySig + 28)

      // Watermark brouillon
      if (!isPaye) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(50); doc.setTextColor(235, 235, 235)
        doc.text("BROUILLON", pageW / 2, pageH / 2, { align: "center", angle: 45 })
      }

      // ── Pied de page SANOVIA ──────────────────────────────────────────────
      const footerH = 18
      const [r, g, b] = [26, 52, 97] // SANOVIA navy
      doc.setFillColor(r, g, b)
      doc.rect(0, pageH - footerH, pageW, footerH, "F")

      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
      doc.text("SANOVIA Health Care", pageW / 2, pageH - footerH + 5, { align: "center" })
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8)
      doc.text(
        "Tel : 656 67 67 67 - 670 44 55 68   |   shcdg@sanoviahc.com   |   Societe a responsabilite limitee",
        pageW / 2, pageH - footerH + 10, { align: "center" }
      )
      doc.text(
        "NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
        pageW / 2, pageH - footerH + 15, { align: "center" }
      )

      const filename = `bulletin_${employe.nom}_${employe.prenom}_${moisLib}_${annee}.pdf`
      const blob     = doc.output("blob")
      const file     = new File([blob], filename, { type: "application/pdf" })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Bulletin ${moisLib} ${annee} — ${employe.prenom} ${employe.nom}`, files: [file] })
      } else {
        doc.save(filename)
      }
    } catch (err) {
      console.error("Erreur PDF :", err)
      alert("Impossible de générer le PDF.")
    }
    setSharing(false)
  }

  // ── Template HTML ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: "Arial", "Helvetica Neue", Helvetica, sans-serif;
          font-size: 10px;
          color: #1e293b;
          background: #e2e8f0;
        }

        /* ── Barre d'action ── */
        .topbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: #1e293b; color: white;
          padding: 10px 20px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .topbar-title { font-size: 13px; font-weight: 600; }
        .topbar-btns  { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 16px; border-radius: 7px; border: none; cursor: pointer;
          font-size: 12px; font-weight: 600; transition: filter 0.15s;
        }
        .btn:hover     { filter: brightness(1.1); }
        .btn:disabled  { opacity: 0.55; cursor: not-allowed; }
        .btn-back      { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); }
        .btn-print     { background: #6366f1; color: white; }
        .btn-share     { background: #10b981; color: white; }

        /* ── Feuille A4 ── */
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 68px auto 28px;
          background: white;
          box-shadow: 0 2px 24px rgba(0,0,0,0.14);
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── En-tête SANOVIA ── */
        .entete {
          padding: 7mm 12mm 5mm;
          border-bottom: 1px solid #e8edf5;
          flex-shrink: 0;
        }
        .entete-logo {
          height: 14mm;
          width: auto;
          display: block;
        }

        /* ── Filigrane logo ── */
        .watermark-logo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 148mm;
          height: auto;
          opacity: 0.04;
          pointer-events: none;
          user-select: none;
          z-index: 0;
        }

        /* ── Corps ── */
        .body {
          padding: 4mm 10mm 5mm;
          flex: 1;
          position: relative;
          z-index: 1;
        }

        /* ── Bloc identité ── */
        .identite {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 0;
          border: 1px solid #e2e8f0;
          margin-bottom: 0;
        }
        .identite-emp, .identite-sal {
          padding: 3mm 4mm;
        }
        .identite-titre {
          font-size: 7.5px; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: 2mm;
        }
        .identite-nom  { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 1.5mm; }
        .identite-line { font-size: 8.5px; color: #475569; line-height: 1.6; }

        .identite-center {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 3mm 6mm;
          border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;
          background: #0f172a; color: white; min-width: 44mm;
          text-align: center;
        }
        .bulletin-titre  { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; }
        .bulletin-period { font-size: 9px; color: #94a3b8; margin-top: 2px; }

        /* ── Bande statut ── */
        .statut-bande {
          background: #1e293b; color: white;
          padding: 1.5mm 4mm;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 8px; font-weight: 600; letter-spacing: 0.04em;
        }
        .badge-paye    { background: #d1fae5; color: #065f46; padding: 1px 8px; border-radius: 20px; }
        .badge-attente { background: #fef3c7; color: #92400e; padding: 1px 8px; border-radius: 20px; }

        /* ── Table ── */
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
        table thead tr { background: #1e293b; color: white; }
        table thead th {
          padding: 2mm 2.5mm; font-size: 7.5px; font-weight: 700;
          text-align: left; letter-spacing: 0.04em; white-space: nowrap;
        }
        table thead th.r { text-align: right; }
        table thead th.c { text-align: center; }
        table tbody tr   { border-bottom: 1px solid #f1f5f9; }
        table tbody tr:hover { background: #f8fafc; }
        table tbody td { padding: 1.5mm 2.5mm; color: #334155; vertical-align: middle; }
        table tbody td.code  { font-size: 8px; color: #94a3b8; text-align: center; }
        table tbody td.r     { text-align: right; font-variant-numeric: tabular-nums; }
        table tbody td.gain  { color: #065f46; font-weight: 600; }
        table tbody td.ret   { color: #991b1b; font-weight: 600; }
        table tbody td.muted { color: #94a3b8; font-style: italic; }
        table tbody tr.sep-ret   { border-top: 1px dashed #e2e8f0; }
        table tbody tr.totaux td {
          padding: 2mm 2.5mm; font-weight: 700; font-size: 9px;
          border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;
        }
        table tbody tr.totaux td.gain-tot { background: #f0fdf4; color: #065f46; }
        table tbody tr.totaux td.ret-tot  { background: #fef2f2; color: #991b1b; }

        /* ── Net à payer ── */
        .net-payer {
          background: #0f172a; color: white;
          display: flex; align-items: center; justify-content: space-between;
          padding: 3.5mm 4mm;
        }
        .net-label   { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
        .net-montant { font-size: 18px; font-weight: 900; color: #34d399; font-variant-numeric: tabular-nums; }

        /* ── Charges patronales ── */
        .charges-bloc {
          margin-top: 3mm;
          padding: 2mm 4mm;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 8px; color: #64748b; line-height: 1.7;
        }
        .charges-title { font-weight: 700; color: #475569; margin-bottom: 1mm; }

        /* ── Notes ── */
        .notes-bloc {
          margin-top: 2.5mm;
          padding: 2mm 4mm;
          background: #f8fafc;
          border-left: 3px solid #6366f1;
          font-size: 8.5px; color: #475569;
        }

        /* ── Signatures ── */
        .signatures {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6mm;
          margin-top: 4mm; padding-top: 3mm; border-top: 1px solid #e2e8f0;
        }
        .sig-box   { text-align: center; }
        .sig-label { font-size: 8.5px; font-weight: 600; color: #475569; margin-bottom: 12mm; }
        .sig-recu  { font-size: 8px; color: #64748b; margin-bottom: 8mm; font-style: italic; }
        .sig-line  { border-top: 1px solid #94a3b8; padding-top: 1.5mm; font-size: 8px; color: #94a3b8; }

        /* ── Watermark brouillon ── */
        .watermark-text {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 80px; font-weight: 900;
          color: rgba(0,0,0,0.04);
          pointer-events: none; user-select: none;
          letter-spacing: 0.05em; white-space: nowrap; z-index: 0;
        }

        /* ── Pied de page SANOVIA ── */
        .footer-sanovia {
          background: ${SANOVIA_NAVY};
          color: white;
          padding: 3mm 10mm;
          text-align: center;
          flex-shrink: 0;
          margin-top: auto;
        }
        .footer-sanovia-nom {
          font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em;
          margin-bottom: 1.5mm;
        }
        .footer-sanovia-row {
          font-size: 7px; color: rgba(255,255,255,0.75);
          line-height: 1.8;
        }
        .footer-sep { margin: 0 5px; opacity: 0.4; }

        /* ── IMPRESSION ── */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body  { background: white; }
          .topbar { display: none !important; }
          .page {
            margin: 0; box-shadow: none;
            width: 100%; min-height: 100vh;
          }
          table tbody tr:hover { background: transparent; }
        }

        /* Mobile */
        @media (max-width: 800px) {
          .page { width: 100%; margin-top: 60px; }
          .topbar { padding: 8px 12px; }
        }
      `}</style>

      {/* Barre d'action */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Bulletin de paie — {employe.prenom} {employe.nom}</div>
        </div>
        <div className="topbar-btns">
          {isMobile && (
            <button className="btn btn-back" onClick={() => window.history.back()}>← Retour</button>
          )}
          {isMobile ? (
            <button className="btn btn-share" onClick={partagerPDF} disabled={sharing}>
              {sharing ? "⏳ Génération…" : "📤 Partager / Télécharger"}
            </button>
          ) : (
            <button className="btn btn-print" onClick={() => window.print()}>
              🖨 Imprimer / Sauvegarder PDF
            </button>
          )}
        </div>
      </div>

      {/* Feuille A4 */}
      <div className="page">

        {/* Filigrane logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-sanovia.png" alt="" className="watermark-logo" aria-hidden="true" />

        {/* Watermark brouillon */}
        {!isPaye && <div className="watermark-text">BROUILLON</div>}

        {/* En-tête SANOVIA */}
        <div className="entete">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sanovia.png" alt="SANOVIA Health Care" className="entete-logo" />
        </div>

        <div className="body">

          {/* Identité employeur / employé */}
          <div className="identite">
            <div className="identite-emp">
              <div className="identite-titre">Employeur</div>
              <div className="identite-nom">{entreprise.nom}</div>
              <div className="identite-line">
                {entreprise.rccm    && <>RCCM : {entreprise.rccm}<br /></>}
                {entreprise.niu     && <>NIU : {entreprise.niu}<br /></>}
                {entreprise.adresse && <>{entreprise.adresse}<br /></>}
                {entreprise.dirigeant && <>Dirigeant : {entreprise.dirigeant}</>}
              </div>
            </div>

            <div className="identite-center">
              <div className="bulletin-titre">BULLETIN DE PAIE</div>
              <div className="bulletin-period">{moisLib.toUpperCase()} {annee}</div>
            </div>

            <div className="identite-sal">
              <div className="identite-titre">Salarié</div>
              <div className="identite-nom">{employe.prenom} {employe.nom}</div>
              <div className="identite-line">
                Matricule : <strong>{employe.matricule}</strong><br />
                Emploi : {employe.poste}<br />
                {employe.departement && <>Département : {employe.departement}<br /></>}
                Contrat : {employe.typeContrat}<br />
                Embauche : {employe.dateEmbauche}
              </div>
            </div>
          </div>

          {/* Bande statut */}
          <div className="statut-bande">
            <span>Période de paie : {moisLib} {annee}</span>
            <span className={isPaye ? "badge-paye" : "badge-attente"}>
              {isPaye ? `✓ Payé${datePaiement ? ` le ${datePaiement}` : ""}` : "⏳ En attente de paiement"}
            </span>
          </div>

          {/* Table rubriques */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: "10%" }}>Code</th>
                  <th style={{ width: "38%" }}>Libellé</th>
                  <th className="r" style={{ width: "14%" }}>Base (FCFA)</th>
                  <th className="c" style={{ width: "10%" }}>Taux</th>
                  <th className="r" style={{ width: "14%" }}>Gains (FCFA)</th>
                  <th className="r" style={{ width: "14%" }}>Retenues (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="code">1000</td>
                  <td><strong>Salaire de base</strong></td>
                  <td className="r">{n(salaireBase)}</td>
                  <td></td>
                  <td className="r gain"><strong>{n(salaireBase)}</strong></td>
                  <td></td>
                </tr>
                {primes > 0 && (
                  <tr>
                    <td className="code">1001</td>
                    <td>Primes et avantages divers</td>
                    <td></td>
                    <td></td>
                    <td className="r gain">{n(primes)}</td>
                    <td></td>
                  </tr>
                )}
                <tr className="sep-ret">
                  <td className="code">3000</td>
                  <td>CNPS — Vieillesse / Invalidité / Décès<br /><span style={{ fontSize: "7.5px", color: "#94a3b8" }}>Plafond : {n(CAMEROUN.CNPS_PLAFOND_MENSUEL)} FCFA/mois</span></td>
                  <td className="r">{n(baseCNPS)}</td>
                  <td style={{ textAlign: "center" }}>4,20 %</td>
                  <td></td>
                  <td className="r ret">{n(calc.cnpsSalarie)}</td>
                </tr>
                <tr>
                  <td className="code"></td>
                  <td className="muted">&nbsp;&nbsp;→ Revenu net imposable (brut − CNPS)</td>
                  <td className="r muted">{n(calc.revenuNetImposable)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td className="code">3001</td>
                  <td>Abattement forfaitaire (max 25 000 FCFA)</td>
                  <td className="r">{n(calc.revenuNetImposable)}</td>
                  <td style={{ textAlign: "center" }}>30 %</td>
                  <td></td>
                  <td className="r ret">{n(calc.abattement)}</td>
                </tr>
                <tr>
                  <td className="code">3002</td>
                  <td>IRPP — Impôt sur le Revenu des Personnes Physiques<br /><span style={{ fontSize: "7.5px", color: "#94a3b8" }}>Barème : 10 % / 15 % / 25 % / 35 %</span></td>
                  <td className="r">{n(calc.baseIRPP)}</td>
                  <td style={{ textAlign: "center", fontSize: "7.5px" }}>Progressif</td>
                  <td></td>
                  <td className="r ret">{n(calc.irpp)}</td>
                </tr>
                <tr>
                  <td className="code">3003</td>
                  <td>CAC — Centimes Additionnels Communaux</td>
                  <td className="r">{n(calc.irpp)}</td>
                  <td style={{ textAlign: "center" }}>10 %</td>
                  <td></td>
                  <td className="r ret">{n(calc.cac)}</td>
                </tr>
                <tr>
                  <td className="code">3004</td>
                  <td>RAV — Redevance Audiovisuelle</td>
                  <td></td>
                  <td style={{ textAlign: "center", fontSize: "7.5px" }}>Forfait</td>
                  <td></td>
                  <td className="r ret">{n(calc.rav)}</td>
                </tr>
                {retenues > 0 && (
                  <tr>
                    <td className="code">3005</td>
                    <td>Autres retenues (avances, absences, divers…)</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="r ret">{n(retenues)}</td>
                  </tr>
                )}
                <tr className="totaux">
                  <td></td>
                  <td>TOTAUX</td>
                  <td></td>
                  <td></td>
                  <td className="r gain-tot">{n(calc.brutImposable)}</td>
                  <td className="r ret-tot">{n(calc.totalRetenues)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net à payer */}
          <div className="net-payer">
            <div className="net-label">NET À PAYER</div>
            <div className="net-montant">{fcfa(calc.netAPayer)}</div>
          </div>

          {/* Charges patronales */}
          <div className="charges-bloc">
            <div className="charges-title">Charges patronales CNPS — informatif (non déduites du salaire)</div>
            <div>
              Vieillesse patronal 3,70 % → <strong>{n(Math.round(baseCNPS * CAMEROUN.CNPS_VIEILLESSE_PAT))}</strong> FCFA &nbsp;|&nbsp;
              Allocations familiales 7,00 % → <strong>{n(Math.round(baseCNPS * CAMEROUN.CNPS_ALLOC_FAM_PAT))}</strong> FCFA &nbsp;|&nbsp;
              AT / MP 2,50 % → <strong>{n(Math.round(baseCNPS * CAMEROUN.CNPS_AT_MP_PAT))}</strong> FCFA &nbsp;|&nbsp;
              <strong>Total patronal 13,20 % → {n(calc.cnpsPatronal)} FCFA</strong>
            </div>
            <div style={{ marginTop: "1mm" }}>
              Coût total employeur (brut + charges patronales) : <strong>{n(calc.coutTotal)} FCFA</strong>
            </div>
          </div>

          {notes && (
            <div className="notes-bloc">
              <strong>Observations :</strong> {notes}
            </div>
          )}

          {/* Signatures */}
          <div className="signatures">
            <div className="sig-box">
              <div className="sig-label">Signature et cachet de l'employeur</div>
              <div className="sig-line">Date et signature</div>
            </div>
            <div className="sig-box">
              <div className="sig-label">Signature du salarié</div>
              <div className="sig-recu">Reçu la somme de : <strong>{fcfa(calc.netAPayer)}</strong></div>
              <div className="sig-line">Lu, approuvé et reçu</div>
            </div>
          </div>
        </div>

        {/* Pied de page SANOVIA */}
        <div className="footer-sanovia">
          <div className="footer-sanovia-nom">SANOVIA Health Care</div>
          <div className="footer-sanovia-row">
            Société à responsabilité limitée
            <span className="footer-sep">|</span>
            Tél : 656 67 67 67 — 670 44 55 68
            <span className="footer-sep">|</span>
            shcdg@sanoviahc.com
          </div>
          <div className="footer-sanovia-row">
            NUI : M0925180497774J &nbsp;/&nbsp; RCCM : CM-NSI-02-2025-B12-00707
          </div>
        </div>
      </div>
    </>
  )
}
