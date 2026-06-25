"use client"

import { useState, useEffect } from "react"
import { type DetailsSalaire, CAMEROUN } from "@/lib/cameroun-salaire"

function n(v: number, decimals = 0) {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fcfa(v: number) { return n(v) + " FCFA" }

// ── Palette SANOVIA ──────────────────────────────────────────────────────────
const C = {
  navy:       "#1a3461",   // bleu marine (pied de page, bandes)
  green:      "#7ab32e",   // vert lime (feuille verte / gains)
  blue:       "#1e8bc0",   // bleu moyen (feuille bleue / boutons)
  greenDark:  "#527a1e",   // vert foncé pour texte gains
  greenLight: "#f2f8e6",   // fond vert très pâle
  blueDark:   "#155f85",   // bleu foncé pour texte retenues
  blueLight:  "#e8f4fb",   // fond bleu très pâle
}
// RGB pour jsPDF
const RGB = {
  navy:       [26, 52, 97]  as [number,number,number],
  green:      [122,179, 46] as [number,number,number],
  greenDark:  [82, 122, 30] as [number,number,number],
  greenLight: [242,248,230] as [number,number,number],
  blue:       [30, 139,192] as [number,number,number],
  blueDark:   [21,  95,133] as [number,number,number],
  blueLight:  [232,244,251] as [number,number,number],
  red:        [180, 20, 20] as [number,number,number],
  redLight:   [254,226,226] as [number,number,number],
  slate:      [71,  85,105] as [number,number,number],
  muted:      [100,116,139] as [number,number,number],
}

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
  const { moisLib, annee, isPaye, datePaiement, notes, employe, entreprise,
          salaireBase, primes, retenues, calc, baseCNPS } = props

  const [platform, setPlatform] = useState<"android" | "ios" | "web">("web")
  const [sharing,  setSharing]  = useState(false)

  useEffect(() => {
    const p = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
    if (p === "android" || p === "ios") setPlatform(p)
  }, [])

  const isMobile = platform === "android" || platform === "ios"

  // ── PDF mobile ───────────────────────────────────────────────────────────
  async function partagerPDF() {
    setSharing(true)
    try {
      const { jsPDF }     = await import("jspdf")
      const { autoTable } = await import("jspdf-autotable")

      const doc   = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const m     = 12

      // Logo
      try {
        const b64 = await loadImageAsBase64("/logo-sanovia.png")
        doc.addImage(b64, "PNG", m, 6, 55, 13.4)
      } catch {
        doc.setFont("helvetica", "bold"); doc.setFontSize(14)
        doc.setTextColor(...RGB.navy); doc.text("SANOVIA HEALTH CARE", m, 14)
      }
      doc.setDrawColor(220, 230, 242); doc.line(0, 24, pageW, 24)

      // Titre "BULLETIN DE PAIE" libre à gauche
      doc.setFont("helvetica", "bold"); doc.setFontSize(13)
      doc.setTextColor(...RGB.navy)
      doc.text("BULLETIN DE PAIE", m, 33)
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
      doc.setTextColor(...RGB.muted)
      doc.text(`Période : ${moisLib} ${annee}`, m, 38.5)

      // Info salarié à droite
      const col2 = pageW / 2 + 10
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...RGB.muted)
      doc.text("SALARIÉ", col2, 27)
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...RGB.navy)
      doc.text(`${employe.prenom.toUpperCase()} ${employe.nom.toUpperCase()}`, col2, 32.5)
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...RGB.slate)
      let yS = 37
      doc.text(`Matricule : ${employe.matricule}`, col2, yS); yS += 4.5
      doc.text(`Emploi : ${employe.poste}`, col2, yS); yS += 4.5
      if (employe.departement) { doc.text(`Dép. : ${employe.departement}`, col2, yS); yS += 4.5 }
      doc.text(`Contrat : ${employe.typeContrat}`, col2, yS)

      // Bande période
      doc.setFillColor(...RGB.navy)
      doc.rect(0, 50, pageW, 9, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
      doc.text(`PÉRIODE : ${moisLib.toUpperCase()} ${annee}`, m, 56)
      const statutTxt = isPaye ? `PAYÉ le ${datePaiement ?? ""}` : "EN ATTENTE DE PAIEMENT"
      doc.setFont("helvetica", "normal")
      doc.text(statutTxt, pageW - m, 56, { align: "right" })

      // Table
      const rows: (string | { content: string; styles?: object })[][] = []
      rows.push([
        { content: "1000", styles: { fontStyle: "bold" } },
        { content: "Salaire de base", styles: { fontStyle: "bold" } },
        { content: n(salaireBase), styles: { halign: "right" } },
        "",
        { content: n(salaireBase), styles: { halign: "right", textColor: RGB.greenDark } },
        "",
      ])
      if (primes > 0) rows.push([
        "1001", "Primes et avantages divers", "", "",
        { content: n(primes), styles: { halign: "right", textColor: RGB.greenDark } }, "",
      ])
      rows.push([
        "3000",
        `CNPS — Vieillesse / Invalidité / Décès (plaf. ${n(CAMEROUN.CNPS_PLAFOND_MENSUEL)} F)`,
        { content: n(baseCNPS), styles: { halign: "right" } }, "4,20 %", "",
        { content: n(calc.cnpsSalarie), styles: { halign: "right", textColor: RGB.red } },
      ])
      rows.push([
        "", "  Revenu net imposable (brut − CNPS)",
        { content: n(calc.revenuNetImposable), styles: { halign: "right", textColor: RGB.muted } },
        "", "", "",
      ])
      rows.push([
        "3001", "Abattement forfaitaire (30 %, max 25 000 FCFA)",
        { content: n(calc.revenuNetImposable), styles: { halign: "right" } }, "30 %", "",
        { content: n(calc.abattement), styles: { halign: "right", textColor: RGB.red } },
      ])
      rows.push([
        "3002", "IRPP — Impôt sur le Revenu des Personnes Physiques",
        { content: n(calc.baseIRPP), styles: { halign: "right" } }, "Progressif", "",
        { content: n(calc.irpp), styles: { halign: "right", textColor: RGB.red } },
      ])
      rows.push([
        "3003", "CAC — Centimes Additionnels Communaux",
        { content: n(calc.irpp), styles: { halign: "right" } }, "10 %", "",
        { content: n(calc.cac), styles: { halign: "right", textColor: RGB.red } },
      ])
      rows.push([
        "3004", "RAV — Redevance Audiovisuelle", "", "Forfait", "",
        { content: n(calc.rav), styles: { halign: "right", textColor: RGB.red } },
      ])
      if (retenues > 0) rows.push([
        "3005", "Autres retenues (avances, absences…)", "", "", "",
        { content: n(retenues), styles: { halign: "right", textColor: RGB.red } },
      ])
      rows.push([
        { content: "", styles: { fillColor: [241,245,249] } },
        { content: "TOTAL BRUT", styles: { fontStyle: "bold", fillColor: [241,245,249] } },
        { content: "", styles: { fillColor: [241,245,249] } },
        { content: "", styles: { fillColor: [241,245,249] } },
        { content: n(calc.brutImposable), styles: { halign: "right", fontStyle: "bold", fillColor: RGB.greenLight, textColor: RGB.greenDark } },
        { content: n(calc.totalRetenues), styles: { halign: "right", fontStyle: "bold", fillColor: RGB.redLight, textColor: RGB.red } },
      ])

      autoTable(doc, {
        startY: 62,
        head: [["Code", "Libellé", "Base (FCFA)", "Taux", "Gains (FCFA)", "Retenues (FCFA)"]],
        body: rows,
        headStyles: { fillColor: RGB.navy, textColor: 255, fontSize: 7.5, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 13, halign: "center", textColor: RGB.muted },
          1: { cellWidth: "auto" },
          2: { cellWidth: 26, halign: "right" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 26, halign: "right" },
          5: { cellWidth: 26, halign: "right" },
        },
        margin: { left: m, right: m },
      })

      const yNet = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 175

      // Net à payer
      doc.setFillColor(...RGB.navy)
      doc.rect(m, yNet + 2, pageW - m * 2, 14, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
      doc.text("NET À PAYER", m + 4, yNet + 10.5)
      doc.setFontSize(13); doc.setTextColor(...RGB.green)
      doc.text(fcfa(calc.netAPayer), pageW - m - 4, yNet + 10.5, { align: "right" })

      // Charges patronales
      const yPat = yNet + 20
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...RGB.slate)
      doc.text("CHARGES PATRONALES — informatif (non déduites du salaire)", m, yPat)
      doc.setFont("helvetica", "normal"); doc.setTextColor(...RGB.muted)
      const patRow = [
        `Vieillesse 3,70 % -> ${n(Math.round(baseCNPS * CAMEROUN.CNPS_VIEILLESSE_PAT))} FCFA`,
        `Alloc. Familiales 7,00 % -> ${n(Math.round(baseCNPS * CAMEROUN.CNPS_ALLOC_FAM_PAT))} FCFA`,
        `AT/MP 2,50 % -> ${n(Math.round(baseCNPS * CAMEROUN.CNPS_AT_MP_PAT))} FCFA`,
        `Total 13,20 % -> ${n(calc.cnpsPatronal)} FCFA`,
        `Cout total employeur -> ${n(calc.coutTotal)} FCFA`,
      ].join("   |   ")
      doc.text(patRow, m, yPat + 5, { maxWidth: pageW - m * 2 })

      if (notes) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...RGB.muted)
        doc.text(`Observations : ${notes}`, m, yPat + 14)
      }

      // Signatures
      const ySig = pageH - 52
      doc.setDrawColor(203, 213, 225); doc.line(m, ySig, pageW - m, ySig)
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...RGB.slate)
      const col2sig = pageW / 2
      doc.text("Signature et cachet de l'employeur :", m, ySig + 6)
      doc.text("Signature du salarie (lu et approuve) :", col2sig + 4, ySig + 6)
      doc.text("Recu la somme de :", col2sig + 4, ySig + 12)
      doc.setFont("helvetica", "italic")
      doc.text(fcfa(calc.netAPayer), col2sig + 4, ySig + 18)
      doc.setDrawColor(203, 213, 225)
      doc.line(m, ySig + 28, m + 75, ySig + 28)
      doc.line(col2sig + 4, ySig + 28, col2sig + 79, ySig + 28)

      if (!isPaye) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(50); doc.setTextColor(235, 235, 235)
        doc.text("BROUILLON", pageW / 2, pageH / 2, { align: "center", angle: 45 })
      }

      // Pied de page SANOVIA
      const footerH = 18
      doc.setFillColor(...RGB.navy)
      doc.rect(0, pageH - footerH, pageW, footerH, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
      doc.text("SANOVIA Health Care", pageW / 2, pageH - footerH + 5, { align: "center" })
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8)
      doc.text("Tel : 656 67 67 67 - 670 44 55 68   |   shcdg@sanoviahc.com   |   Societe a responsabilite limitee",
        pageW / 2, pageH - footerH + 10, { align: "center" })
      doc.text("NUI : M0925180497774J   /   RCCM : CM-NSI-02-2025-B12-00707",
        pageW / 2, pageH - footerH + 15, { align: "center" })

      const filename = `bulletin_${employe.nom}_${employe.prenom}_${moisLib}_${annee}.pdf`
      const blob = doc.output("blob")
      const file = new File([blob], filename, { type: "application/pdf" })

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
          font-size: 10px; color: #1e293b; background: #e2e8f0;
        }

        /* ── Topbar ── */
        .topbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: ${C.navy}; color: white;
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
        .btn:hover    { filter: brightness(1.1); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-back  { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); }
        .btn-print { background: ${C.blue};  color: white; }
        .btn-share { background: ${C.green}; color: white; }

        /* ── Page A4 ── */
        .page {
          width: 210mm; min-height: 297mm;
          margin: 68px auto 28px;
          background: white;
          box-shadow: 0 2px 24px rgba(0,0,0,0.14);
          position: relative; display: flex; flex-direction: column; overflow: hidden;
        }

        /* ── En-tête logo ── */
        .entete {
          padding: 6mm 12mm 4mm;
          border-bottom: 2px solid ${C.green};
          flex-shrink: 0;
        }
        .entete-logo { height: 13mm; width: auto; display: block; }

        /* ── Filigrane ── */
        .watermark-logo {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 148mm; height: auto; opacity: 0.035;
          pointer-events: none; user-select: none; z-index: 0;
        }
        .watermark-text {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 80px; font-weight: 900; color: rgba(0,0,0,0.04);
          pointer-events: none; user-select: none; white-space: nowrap; z-index: 0;
        }

        /* ── Corps ── */
        .body { padding: 5mm 10mm 5mm; flex: 1; position: relative; z-index: 1; }

        /* ── Header bulletin ── */
        .bulletin-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 3mm;
          padding-bottom: 3mm;
          border-bottom: 1px solid #e8edf5;
        }
        .bulletin-titre-main {
          font-size: 15px; font-weight: 900; color: ${C.navy};
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 1.5mm;
        }
        .bulletin-periode {
          font-size: 9px; color: #64748b; font-weight: 500;
        }
        .sal-bloc { text-align: right; }
        .sal-titre {
          font-size: 7.5px; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.5mm;
        }
        .sal-nom   { font-size: 11px; font-weight: 800; color: ${C.navy}; margin-bottom: 1.5mm; }
        .sal-line  { font-size: 8.5px; color: #475569; line-height: 1.7; }

        /* ── Bande statut ── */
        .statut-bande {
          background: ${C.navy}; color: white;
          padding: 1.5mm 4mm;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 8px; font-weight: 600; letter-spacing: 0.04em;
          margin-bottom: 0;
        }
        .badge-paye    { background: ${C.greenLight}; color: ${C.greenDark}; padding: 1px 8px; border-radius: 20px; }
        .badge-attente { background: #fef3c7; color: #92400e; padding: 1px 8px; border-radius: 20px; }

        /* ── Table ── */
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
        table thead tr { background: ${C.navy}; color: white; }
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
        table tbody td.gain  { color: ${C.greenDark}; font-weight: 600; }
        table tbody td.ret   { color: #991b1b; font-weight: 600; }
        table tbody td.muted { color: #94a3b8; font-style: italic; }
        table tbody tr.sep-ret { border-top: 1px dashed #e2e8f0; }
        table tbody tr.totaux td {
          padding: 2mm 2.5mm; font-weight: 700; font-size: 9px;
          border-top: 2px solid ${C.navy}; border-bottom: 2px solid ${C.navy};
        }
        table tbody tr.totaux td.gain-tot { background: ${C.greenLight}; color: ${C.greenDark}; }
        table tbody tr.totaux td.ret-tot  { background: #fef2f2; color: #991b1b; }

        /* ── Net à payer ── */
        .net-payer {
          background: ${C.navy}; color: white;
          display: flex; align-items: center; justify-content: space-between;
          padding: 3.5mm 4mm;
        }
        .net-label   { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
        .net-montant { font-size: 18px; font-weight: 900; color: ${C.green}; font-variant-numeric: tabular-nums; }

        /* ── Charges patronales ── */
        .charges-bloc {
          margin-top: 3mm; padding: 2mm 4mm;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;
          font-size: 8px; color: #64748b; line-height: 1.7;
        }
        .charges-title { font-weight: 700; color: #475569; margin-bottom: 1mm; }

        /* ── Notes ── */
        .notes-bloc {
          margin-top: 2.5mm; padding: 2mm 4mm;
          background: #f8fafc; border-left: 3px solid ${C.blue};
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

        /* ── Pied de page SANOVIA ── */
        .footer-sanovia {
          background: ${C.navy}; color: white;
          padding: 3mm 10mm; text-align: center;
          flex-shrink: 0; margin-top: auto;
        }
        .footer-sanovia-nom { font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 1.5mm; }
        .footer-sanovia-row { font-size: 7px; color: rgba(255,255,255,0.75); line-height: 1.8; }
        .footer-sep { margin: 0 5px; opacity: 0.4; }

        /* ── Impression ── */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body  { background: white; }
          .topbar { display: none !important; }
          .page { margin: 0; box-shadow: none; width: 100%; min-height: 100vh; }
          table tbody tr:hover { background: transparent; }
        }
        @media (max-width: 800px) {
          .page { width: 100%; margin-top: 60px; }
          .topbar { padding: 8px 12px; }
        }
      `}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">Bulletin de paie — {employe.prenom} {employe.nom}</div>
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

      {/* Page A4 */}
      <div className="page">

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-sanovia.png" alt="" className="watermark-logo" aria-hidden="true" />
        {!isPaye && <div className="watermark-text">BROUILLON</div>}

        {/* En-tête logo */}
        <div className="entete">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sanovia.png" alt="SANOVIA Health Care" className="entete-logo" />
        </div>

        <div className="body">

          {/* Titre + Salarié */}
          <div className="bulletin-header">
            <div>
              <div className="bulletin-titre-main">Bulletin de Paie</div>
              <div className="bulletin-periode">Période : {moisLib} {annee}</div>
            </div>
            <div className="sal-bloc">
              <div className="sal-titre">Salarié</div>
              <div className="sal-nom">{employe.prenom} {employe.nom}</div>
              <div className="sal-line">
                Matricule : <strong>{employe.matricule}</strong><br />
                {employe.poste}<br />
                {employe.departement && <>{employe.departement}<br /></>}
                {employe.typeContrat} · Embauche : {employe.dateEmbauche}
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

          {/* Table */}
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
                    <td></td><td></td>
                    <td className="r gain">{n(primes)}</td>
                    <td></td>
                  </tr>
                )}
                <tr className="sep-ret">
                  <td className="code">3000</td>
                  <td>CNPS — Vieillesse / Invalidité / Décès<br /><span style={{ fontSize:"7.5px", color:"#94a3b8" }}>Plafond : {n(CAMEROUN.CNPS_PLAFOND_MENSUEL)} FCFA/mois</span></td>
                  <td className="r">{n(baseCNPS)}</td>
                  <td style={{ textAlign:"center" }}>4,20 %</td>
                  <td></td>
                  <td className="r ret">{n(calc.cnpsSalarie)}</td>
                </tr>
                <tr>
                  <td className="code"></td>
                  <td className="muted">&nbsp;&nbsp;→ Revenu net imposable (brut − CNPS)</td>
                  <td className="r muted">{n(calc.revenuNetImposable)}</td>
                  <td></td><td></td><td></td>
                </tr>
                <tr>
                  <td className="code">3001</td>
                  <td>Abattement forfaitaire (max 25 000 FCFA)</td>
                  <td className="r">{n(calc.revenuNetImposable)}</td>
                  <td style={{ textAlign:"center" }}>30 %</td>
                  <td></td>
                  <td className="r ret">{n(calc.abattement)}</td>
                </tr>
                <tr>
                  <td className="code">3002</td>
                  <td>IRPP — Impôt sur le Revenu des Personnes Physiques<br /><span style={{ fontSize:"7.5px", color:"#94a3b8" }}>Barème : 10 % / 15 % / 25 % / 35 %</span></td>
                  <td className="r">{n(calc.baseIRPP)}</td>
                  <td style={{ textAlign:"center", fontSize:"7.5px" }}>Progressif</td>
                  <td></td>
                  <td className="r ret">{n(calc.irpp)}</td>
                </tr>
                <tr>
                  <td className="code">3003</td>
                  <td>CAC — Centimes Additionnels Communaux</td>
                  <td className="r">{n(calc.irpp)}</td>
                  <td style={{ textAlign:"center" }}>10 %</td>
                  <td></td>
                  <td className="r ret">{n(calc.cac)}</td>
                </tr>
                <tr>
                  <td className="code">3004</td>
                  <td>RAV — Redevance Audiovisuelle</td>
                  <td></td>
                  <td style={{ textAlign:"center", fontSize:"7.5px" }}>Forfait</td>
                  <td></td>
                  <td className="r ret">{n(calc.rav)}</td>
                </tr>
                {retenues > 0 && (
                  <tr>
                    <td className="code">3005</td>
                    <td>Autres retenues (avances, absences, divers…)</td>
                    <td></td><td></td><td></td>
                    <td className="r ret">{n(retenues)}</td>
                  </tr>
                )}
                <tr className="totaux">
                  <td></td>
                  <td>TOTAUX</td>
                  <td></td><td></td>
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
            <div style={{ marginTop:"1mm" }}>
              Coût total employeur : <strong>{n(calc.coutTotal)} FCFA</strong>
            </div>
          </div>

          {notes && (
            <div className="notes-bloc"><strong>Observations :</strong> {notes}</div>
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
