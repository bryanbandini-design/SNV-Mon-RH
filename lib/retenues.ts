import { prisma } from "@/lib/prisma"

// Code du Travail Cameroun : 26 jours ouvrables × 8h = 208h mensuelles
const JOURS_OUVRES_MOIS = 26
const HEURES_MOIS = 208

/** Calcule la retenue pour jours d'absence (salaireBase ÷ 26 × jours) */
export function calculerRetenueAbsence(joursAbsence: number, salaireBase: number): number {
  return Math.round((salaireBase / JOURS_OUVRES_MOIS) * joursAbsence)
}

/** Calcule le montant de retenue pour un retard (taux horaire × 2 × heures) */
export function calculerRetenueRetard(minutesRetard: number, salaireBase: number): number {
  const heuresRetard = minutesRetard / 60
  const tauxHoraire  = salaireBase / HEURES_MOIS
  return Math.round(heuresRetard * tauxHoraire * 2)
}

/** Crée une retenue provisoire et notifie les responsables + admin */
export async function creerRetenueProvisoire({
  employeId,
  presenceId,
  type,
  date,
  montant,
  description,
}: {
  employeId:  string
  presenceId: string
  type:       "ABSENCE" | "RETARD"
  date:       Date
  montant:    number
  description: string
}) {
  // Créer la retenue
  const retenue = await prisma.retenueAbsence.create({
    data: { employeId, presenceId, type, date, montant, description, statut: "EN_ATTENTE" },
  })

  // Récupérer employé + utilisateur + admins/responsables à notifier
  const employe = await prisma.employe.findUnique({
    where:  { id: employeId },
    select: { prenom: true, nom: true, matricule: true },
  })

  const dateLabel = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  const titre     = type === "ABSENCE"
    ? `Retenue absence — ${employe?.prenom} ${employe?.nom}`
    : `Retenue retard — ${employe?.prenom} ${employe?.nom}`
  const message   = type === "ABSENCE"
    ? `Absence le ${dateLabel}. Retenue provisoire de ${montant.toLocaleString("fr-FR")} FCFA appliquée — en attente de validation administrateur.`
    : `Retard le ${dateLabel} — ${description}. Retenue provisoire de ${montant.toLocaleString("fr-FR")} FCFA appliquée — en attente de validation administrateur.`

  // Notifier tous les ADMIN et RESPONSABLE
  const destinataires = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "RESPONSABLE"] } },
    select: { id: true },
  })

  if (destinataires.length > 0) {
    await prisma.notification.createMany({
      data: destinataires.map(u => ({
        userId:  u.id,
        type:    "RETENUE_PROVISOIRE",
        titre,
        message,
      })),
    })
  }

  return retenue
}
