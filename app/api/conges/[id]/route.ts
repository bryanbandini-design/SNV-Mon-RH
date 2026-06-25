import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const { statut, commentaire } = await req.json()

  const conge = await prisma.conge.update({
    where: { id },
    data: { statut, commentaire: commentaire || null },
    include: { employe: { select: { prenom: true, nom: true, utilisateur: { select: { id: true } } } } },
  })

  const employeUser = conge.employe?.utilisateur
  if (employeUser && (statut === "APPROUVE" || statut === "REFUSE")) {
    const debut = new Date(conge.dateDebut).toLocaleDateString("fr-FR")
    const fin   = new Date(conge.dateFin).toLocaleDateString("fr-FR")
    await prisma.notification.create({
      data: {
        userId:  employeUser.id,
        type:    statut === "APPROUVE" ? "CONGE_APPROUVE" : "CONGE_REFUSE",
        titre:   statut === "APPROUVE" ? "Congé approuvé ✓" : "Congé refusé",
        message: statut === "APPROUVE"
          ? `Votre demande de congé (${conge.type}) du ${debut} au ${fin} a été approuvée.${commentaire ? ` Commentaire : ${commentaire}` : ""}`
          : `Votre demande de congé (${conge.type}) du ${debut} au ${fin} a été refusée.${commentaire ? ` Motif : ${commentaire}` : ""}`,
      },
    })
  }

  const actionLabel = statut === "APPROUVE" ? "Approbation" : statut === "REFUSE" ? "Refus" : "Mise à jour"
  await logActivity({
    session,
    action: statut === "APPROUVE" ? "APPROVE" : statut === "REFUSE" ? "REJECT" : "UPDATE",
    module: "CONGES",
    description: `${actionLabel} du congé ${conge.type} de ${conge.employe.prenom} ${conge.employe.nom}${commentaire ? ` — ${commentaire}` : ""}`,
    entityId: id,
    entityType: "Conge",
    metadata: { statut, type: conge.type },
  })

  return NextResponse.json(conge)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const conge = await prisma.conge.findUnique({
    where: { id },
    include: { employe: { select: { prenom: true, nom: true } } },
  })
  await prisma.conge.delete({ where: { id } })

  await logActivity({
    session,
    action: "DELETE",
    module: "CONGES",
    description: `Suppression de la demande de congé de ${conge?.employe.prenom ?? ""} ${conge?.employe.nom ?? ""}`,
    entityId: id,
    entityType: "Conge",
  })

  return NextResponse.json({ ok: true })
}
