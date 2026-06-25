import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { ids, statut, commentaire } = await req.json() as {
    ids: string[]
    statut: "APPROUVE" | "REFUSE"
    commentaire?: string
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ message: "Aucun congé sélectionné" }, { status: 400 })
  }

  const conges = await prisma.conge.findMany({
    where: { id: { in: ids }, statut: "EN_ATTENTE" },
    include: { employe: { select: { prenom: true, nom: true, utilisateur: { select: { id: true } } } } },
  })

  await prisma.conge.updateMany({
    where: { id: { in: conges.map(c => c.id) } },
    data:  { statut, commentaire: commentaire || null },
  })

  // Déduction automatique du solde pour congés annuels approuvés en masse
  if (statut === "APPROUVE") {
    const congesAnnuels = conges.filter(c => c.type === "ANNUEL")
    for (const c of congesAnnuels) {
      await prisma.employe.update({
        where: { id: c.employeId },
        data:  { soldeCongesAnnuels: { decrement: c.nbJours } },
      })
    }
  }

  // Notifications employés
  const notifData = conges
    .filter(c => c.employe.utilisateur)
    .map(c => {
      const debut = new Date(c.dateDebut).toLocaleDateString("fr-FR")
      const fin   = new Date(c.dateFin).toLocaleDateString("fr-FR")
      return {
        userId:  c.employe.utilisateur!.id,
        type:    statut === "APPROUVE" ? "CONGE_APPROUVE" : "CONGE_REFUSE",
        titre:   statut === "APPROUVE" ? "Congé approuvé ✓" : "Congé refusé",
        message: statut === "APPROUVE"
          ? `Votre demande de congé (${c.type}) du ${debut} au ${fin} a été approuvée.`
          : `Votre demande de congé (${c.type}) du ${debut} au ${fin} a été refusée.${commentaire ? ` Motif : ${commentaire}` : ""}`,
      }
    })

  if (notifData.length > 0) {
    await prisma.notification.createMany({ data: notifData })
  }

  await logActivity({
    session,
    action: statut === "APPROUVE" ? "APPROVE" : "REJECT",
    module: "CONGES",
    description: `Traitement en masse de ${conges.length} congé(s) → ${statut}`,
    metadata: { ids, statut },
  })

  return NextResponse.json({ updated: conges.length })
}
