import { prisma } from "@/lib/prisma"
export { calculerRetenueAbsence, calculerRetenueRetard } from "@/lib/retenues-calcul"

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
