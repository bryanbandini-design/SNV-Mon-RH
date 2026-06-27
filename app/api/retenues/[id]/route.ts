import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ message: "Réservé à l'administrateur" }, { status: 403 })
  }

  const { id }   = await params
  const { action } = await req.json() as { action: "VALIDER" | "ANNULER" }

  if (!["VALIDER", "ANNULER"].includes(action)) {
    return NextResponse.json({ message: "Action invalide" }, { status: 400 })
  }

  const retenue = await prisma.retenueAbsence.findUnique({
    where: { id },
    include: {
      employe: {
        select: {
          prenom: true, nom: true,
          utilisateur: { select: { id: true } },
        },
      },
    },
  })

  if (!retenue) return NextResponse.json({ message: "Non trouvé" }, { status: 404 })
  if (retenue.statut !== "EN_ATTENTE") {
    return NextResponse.json({ message: "Retenue déjà traitée" }, { status: 409 })
  }

  const updated = await prisma.retenueAbsence.update({
    where: { id },
    data:  { statut: action === "VALIDER" ? "VALIDEE" : "ANNULEE" },
  })

  // Notifier l'employé de la décision
  const userId = retenue.employe.utilisateur?.id
  if (userId) {
    const dateLabel = retenue.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    const typeLabel = retenue.type === "ABSENCE" ? "absence" : "retard"

    await prisma.notification.create({
      data: {
        userId,
        type:    action === "VALIDER" ? "RETENUE_VALIDEE" : "RETENUE_ANNULEE",
        titre:   action === "VALIDER"
          ? `Retenue ${typeLabel} confirmée`
          : `Retenue ${typeLabel} annulée`,
        message: action === "VALIDER"
          ? `La retenue de ${retenue.montant.toLocaleString("fr-FR")} FCFA pour votre ${typeLabel} du ${dateLabel} a été confirmée par l'administrateur.`
          : `La retenue de ${retenue.montant.toLocaleString("fr-FR")} FCFA pour votre ${typeLabel} du ${dateLabel} a été annulée par l'administrateur.`,
      },
    })
  }

  return NextResponse.json(updated)
}
