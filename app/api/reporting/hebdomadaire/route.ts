import { NextResponse } from "next/server"
import { genererDonneesRapport, genererHtmlRapport } from "@/lib/rapport-hebdomadaire"
import { sendEmail } from "@/lib/email"

// Appelé par Vercel Cron chaque lundi à 07:00 UTC
// ou manuellement par un admin via POST /api/reporting/hebdomadaire
export async function POST(req: Request) {
  // Vérification du secret Vercel Cron (ou appel manuel admin)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = authHeader === `Bearer ${cronSecret}`

  // Appel manuel : vérifier le secret dans le body
  if (!isVercelCron) {
    const body = await req.json().catch(() => ({}))
    if (!cronSecret || body.secret !== cronSecret) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
    }
  }

  // Semaine passée : lundi → dimanche
  const maintenant = new Date()
  const jourSemaine = maintenant.getDay() // 0=dim, 1=lun...
  const diffLundi   = jourSemaine === 0 ? -6 : 1 - jourSemaine

  const lundi = new Date(maintenant)
  lundi.setDate(maintenant.getDate() + diffLundi - 7)
  lundi.setHours(0, 0, 0, 0)

  const dimanche = new Date(lundi)
  dimanche.setDate(lundi.getDate() + 6)
  dimanche.setHours(23, 59, 59, 999)

  const periodeLabel = {
    debut: lundi.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    fin:   dimanche.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  }

  const donnees = await genererDonneesRapport(lundi, dimanche)
  const html    = genererHtmlRapport(donnees, periodeLabel)

  const destinataire = process.env.REPORT_EMAIL || "bryanbandini@gmail.com"

  await sendEmail({
    to:      destinataire,
    subject: `Rapport RH Hebdomadaire — ${periodeLabel.debut} au ${periodeLabel.fin}`,
    html,
  })

  return NextResponse.json({
    ok:     true,
    periode: periodeLabel,
    stats: {
      presents:  donnees.nbPresents,
      absents:   donnees.nbAbsents,
      retards:   donnees.nbRetards,
      heures:    donnees.heuresTot,
      heuresSup: donnees.heuresSup.length,
      conges:    donnees.conges.length,
    },
  })
}
