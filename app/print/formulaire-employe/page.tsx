import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { TYPES_CONTRAT } from "@/lib/utils"

export default async function FormulaireEmployePrintPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const parametres = await prisma.parametre.findMany()
  const map: Record<string, string> = Object.fromEntries(parametres.map(r => [r.cle, r.valeur]))
  const entreprise = {
    nom:     map.ENTREPRISE_NOM     || "Mon Entreprise",
    adresse: map.ENTREPRISE_ADRESSE || "",
    rccm:    map.ENTREPRISE_RCCM    || "",
    niu:     map.ENTREPRISE_NIU     || "",
  }

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
        .page { max-width: 720px; margin: 0 auto; padding: 0; }
        .no-print { display: none !important; }
        @media screen { body { padding: 24px; background: #f8fafc; } .page { background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-radius: 8px; } }
        h1 { font-size: 16px; margin: 0 0 2px; color: #0f172a; }
        h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 8px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
        .company { font-size: 10px; color: #475569; margin-top: 4px; }
        .doc-meta { text-align: right; }
        .doc-title { font-size: 13px; font-weight: 700; color: #0f172a; }
        .doc-ref { font-size: 9px; color: #94a3b8; margin-top: 2px; }
        .section { margin-bottom: 18px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
        .grid.full { grid-template-columns: 1fr; }
        .field { display: flex; flex-direction: column; gap: 3px; }
        .field label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
        .field .line { border: 0; border-bottom: 1px solid #94a3b8; min-height: 22px; width: 100%; }
        .field .line-box { border: 1px solid #cbd5e1; border-radius: 4px; min-height: 52px; width: 100%; margin-top: 2px; }
        .checkbox-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .checkbox-row input[type=checkbox] { width: 13px; height: 13px; border: 1px solid #64748b; appearance: none; border-radius: 2px; flex-shrink: 0; }
        .select-options { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 4px; }
        .select-options label { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #334155; }
        .select-options input[type=radio] { width: 12px; height: 12px; accent-color: #0f172a; }
        .divider { border: 0; border-top: 1px dashed #cbd5e1; margin: 14px 0; }
        .footer { margin-top: 24px; border-top: 1.5px solid #e2e8f0; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .sig-block { display: flex; flex-direction: column; gap: 3px; }
        .sig-block .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
        .sig-block .sig-line { border-bottom: 1px solid #94a3b8; margin-top: 40px; }
        .notice { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; font-size: 9px; color: #64748b; margin-top: 16px; line-height: 1.5; }
        .print-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #0f172a; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
        .print-btn:hover { background: #1e293b; }
        @media print { .no-print { display: none !important; } body { padding: 0; background: #fff; } .page { border: none; border-radius: 0; padding: 0; } }
      `}</style>

      {/* Bouton impression visible seulement à l'écran */}
      <div className="no-print" style={{ display: "flex", gap: "10px", marginBottom: "0", alignItems: "center" }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <button className="print-btn" onClick={"window.print()" as any}>
          🖨 Imprimer le formulaire
        </button>
        <span style={{ fontSize: "12px", color: "#64748b" }}>Transmettez ce document au responsable pour collecte des informations.</span>
      </div>

      <div className="page">
        {/* En-tête */}
        <div className="header">
          <div>
            <h1>{entreprise.nom}</h1>
            <div className="company">
              {entreprise.adresse && <div>{entreprise.adresse}</div>}
              {entreprise.rccm && <div>RCCM : {entreprise.rccm}</div>}
              {entreprise.niu && <div>NIU : {entreprise.niu}</div>}
            </div>
          </div>
          <div className="doc-meta">
            <div className="doc-title">FICHE D&apos;ENRÔLEMENT SALARIÉ</div>
            <div className="doc-ref">Réf. RH-EMP · À retourner au service RH</div>
            <div className="doc-ref" style={{ marginTop: 6 }}>Date : _____ / _____ / _______</div>
          </div>
        </div>

        {/* Informations personnelles */}
        <div className="section">
          <h2>1 — Informations personnelles</h2>
          <div className="grid">
            <div className="field"><label>Prénom *</label><div className="line" /></div>
            <div className="field"><label>Nom *</label><div className="line" /></div>
            <div className="field"><label>Date de naissance</label><div className="line" /></div>
            <div className="field"><label>Lieu de naissance</label><div className="line" /></div>
            <div className="field"><label>Nationalité</label><div className="line" /></div>
            <div className="field"><label>CNI / Passeport (N°)</label><div className="line" /></div>
            <div className="field"><label>Email</label><div className="line" /></div>
            <div className="field"><label>Téléphone</label><div className="line" /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="field"><label>Adresse complète</label><div className="line" /></div>
          </div>
        </div>

        <hr className="divider" />

        {/* Informations professionnelles */}
        <div className="section">
          <h2>2 — Informations professionnelles</h2>
          <div className="grid">
            <div className="field"><label>Matricule *</label><div className="line" /></div>
            <div className="field"><label>Poste *</label><div className="line" /></div>
            <div className="field"><label>Département / Service</label><div className="line" /></div>
            <div className="field"><label>Date d&apos;embauche *</label><div className="line" /></div>
            <div className="field"><label>Date de fin de contrat (si applicable)</label><div className="line" /></div>
            <div className="field"><label>Salaire de base brut (FCFA) *</label><div className="line" /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="field">
              <label>Type de contrat *</label>
              <div className="select-options">
                {TYPES_CONTRAT.map(t => (
                  <label key={t}>
                    <input type="radio" name="typeContrat" value={t} readOnly /> {t}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* Période d'essai */}
        <div className="section">
          <h2>3 — Période d&apos;essai</h2>
          <div className="checkbox-row">
            <input type="checkbox" readOnly />
            <span style={{ fontSize: 10 }}>Le salarié est soumis à une période d&apos;essai</span>
          </div>
          <div className="grid" style={{ marginTop: 8 }}>
            <div className="field"><label>Début de la période d&apos;essai</label><div className="line" /></div>
            <div className="field"><label>Fin de la période d&apos;essai</label><div className="line" /></div>
          </div>
        </div>

        <hr className="divider" />

        {/* Notes */}
        <div className="section">
          <h2>4 — Observations / Notes</h2>
          <div className="field"><label>Informations complémentaires</label><div className="line-box" /></div>
        </div>

        {/* Signatures */}
        <div className="footer">
          <div className="sig-block">
            <div className="sig-label">Signature du salarié</div>
            <div className="sig-line" />
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4 }}>Nom &amp; Signature</div>
          </div>
          <div className="sig-block">
            <div className="sig-label">Visa du responsable RH</div>
            <div className="sig-line" />
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4 }}>Nom, Signature &amp; Cachet</div>
          </div>
        </div>

        <div className="notice">
          <strong>Note :</strong> Les champs marqués d&apos;un astérisque (*) sont obligatoires pour l&apos;enrôlement sur la plateforme.
          Ce formulaire doit être retourné au service RH dûment complété et signé avant toute création du compte salarié.
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: "document.querySelector('.print-btn').addEventListener('click', () => window.print())" }} />
    </>
  )
}
