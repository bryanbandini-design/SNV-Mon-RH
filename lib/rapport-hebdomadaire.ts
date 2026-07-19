import { prisma } from "@/lib/prisma"

export async function genererDonneesRapport(dateDebut: Date, dateFin: Date) {
  const [presences, conges, employes, saisiesManuelles, heuresSup] = await Promise.all([
    // Présences de la semaine
    prisma.presence.findMany({
      where: { date: { gte: dateDebut, lte: dateFin }, saisieManuelle: false },
      include: { employe: { select: { prenom: true, nom: true, poste: true } } },
    }),
    // Congés actifs cette semaine
    prisma.conge.findMany({
      where: {
        statut: "APPROUVE",
        OR: [
          { dateDebut: { gte: dateDebut, lte: dateFin } },
          { dateFin:   { gte: dateDebut, lte: dateFin } },
          { dateDebut: { lte: dateDebut }, dateFin: { gte: dateFin } },
        ],
      },
      include: { employe: { select: { prenom: true, nom: true } } },
    }),
    // Effectif total actif
    prisma.employe.count({ where: { statut: "ACTIF" } }),
    // Saisies manuelles en attente de validation
    prisma.presence.count({
      where: { saisieManuelle: true, statutValidation: "EN_ATTENTE" },
    }),
    // Heures supplémentaires en attente de validation
    prisma.presence.findMany({
      where: { statutHeuresSup: "EN_ATTENTE" },
      include: { employe: { select: { prenom: true, nom: true } } },
    }),
  ])

  const nbPresents = presences.filter(p => p.statut === "PRESENT" || p.statut === "RETARD").length
  const nbAbsents  = presences.filter(p => p.statut === "ABSENT").length
  const nbRetards  = presences.filter(p => p.statut === "RETARD").length
  const heuresTot  = presences.reduce((acc, p) => acc + (p.heuresTravaillees ?? 0), 0)

  return {
    nbPresents, nbAbsents, nbRetards, heuresTot,
    conges, employes, saisiesManuelles, heuresSup,
    totalPresences: presences.length,
  }
}

export function genererHtmlRapport(
  d: Awaited<ReturnType<typeof genererDonneesRapport>>,
  periode: { debut: string; fin: string }
) {
  const tauxPresence = d.totalPresences > 0
    ? Math.round((d.nbPresents / d.totalPresences) * 100)
    : 0

  const blocHS = d.heuresSup.length > 0
    ? d.heuresSup.map((s: { employe: { prenom: string; nom: string }; heuresSupBrutes: number }) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;">${s.employe.prenom} ${s.employe.nom}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
            <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;">
              +${s.heuresSupBrutes.toFixed(1)}h
            </span>
          </td>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${s.employe.nom}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">Aucune heure supplémentaire en attente</td></tr>`

  const blocConges = d.conges.length > 0
    ? d.conges.map((c: { employe: { prenom: string; nom: string }; dateDebut: Date; dateFin: Date; type: string }) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;">${c.employe.prenom} ${c.employe.nom}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">
            ${new Date(c.dateDebut).toLocaleDateString("fr-FR")} → ${new Date(c.dateFin).toLocaleDateString("fr-FR")}
          </td>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;">
            <span style="background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:999px;font-size:12px;">${c.type}</span>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">Aucun congé cette semaine</td></tr>`

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a3461,#2563eb);border-radius:16px 16px 0 0;padding:32px 36px;">
            <p style="margin:0;color:#7ab32e;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SANOVIA Health Care</p>
            <h1 style="margin:8px 0 4px;color:#ffffff;font-size:22px;font-weight:700;">Rapport RH hebdomadaire</h1>
            <p style="margin:0;color:#93c5fd;font-size:13px;">Semaine du ${periode.debut} au ${periode.fin}</p>
          </td>
        </tr>

        <!-- KPI CARDS -->
        <tr>
          <td style="background:#ffffff;padding:24px 36px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="25%" style="padding:4px;">
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;">${d.nbPresents}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#15803d;font-weight:600;">PRESENTS</p>
                  </div>
                </td>
                <td width="25%" style="padding:4px;">
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#dc2626;">${d.nbAbsents}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#b91c1c;font-weight:600;">ABSENTS</p>
                  </div>
                </td>
                <td width="25%" style="padding:4px;">
                  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#d97706;">${d.nbRetards}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#b45309;font-weight:600;">RETARDS</p>
                  </div>
                </td>
                <td width="25%" style="padding:4px;">
                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#2563eb;">${d.heuresTot.toFixed(0)}h</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#1d4ed8;font-weight:600;">HEURES</p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Taux de présence -->
            <div style="margin-top:16px;background:#f8fafc;border-radius:10px;padding:12px 16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:12px;color:#64748b;font-weight:600;">Taux de présence</span>
                <span style="font-size:13px;font-weight:700;color:#1a3461;">${tauxPresence}%</span>
              </div>
              <div style="background:#e2e8f0;border-radius:999px;height:6px;">
                <div style="background:#7ab32e;border-radius:999px;height:6px;width:${tauxPresence}%;"></div>
              </div>
            </div>
          </td>
        </tr>

        <!-- ALERTES -->
        ${(d.saisiesManuelles > 0 || d.heuresSup.length > 0) ? `
        <tr>
          <td style="background:#ffffff;padding:0 36px 16px;">
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">⚠️ Actions requises</p>
              <ul style="margin:8px 0 0;padding-left:20px;font-size:12px;color:#78350f;">
                ${d.saisiesManuelles > 0 ? `<li>${d.saisiesManuelles} saisie(s) manuelle(s) en attente de validation</li>` : ""}
                ${d.heuresSup.length > 0 ? `<li>${d.heuresSup.length} fiche(s) avec heures supplémentaires à valider ou rejeter</li>` : ""}
              </ul>
            </div>
          </td>
        </tr>` : ""}

        <!-- HEURES SUP -->
        <tr>
          <td style="background:#ffffff;padding:0 36px 20px;">
            <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1a3461;">Heures supplémentaires en attente</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Employé</th>
                  <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">HS</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Nom</th>
                </tr>
              </thead>
              <tbody>${blocHS}</tbody>
            </table>
          </td>
        </tr>

        <!-- CONGÉS -->
        <tr>
          <td style="background:#ffffff;padding:0 36px 24px;">
            <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1a3461;">Congés en cours / semaine</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Employé</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Période</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Type</th>
                </tr>
              </thead>
              <tbody>${blocConges}</tbody>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#1a3461;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
            <p style="margin:0;color:#93c5fd;font-size:12px;">SANOVIA Health Care — Rapport généré automatiquement chaque lundi</p>
            <p style="margin:4px 0 0;color:#4b5563;font-size:11px;">NUI : M0925180497774J — shcdg@sanoviahc.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
