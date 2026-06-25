import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const { statut } = await req.json()

  const avance = await prisma.avanceSalaire.update({
    where: { id },
    data: { statut },
    include: { employe: { select: { prenom: true, nom: true } } },
  })

  await logActivity({
    session,
    action: "UPDATE",
    module: "SALAIRES",
    description: `Avance ${statut === "VALIDEE" ? "validée" : "annulée"} — ${avance.employe.prenom} ${avance.employe.nom}`,
    entityId: id,
    entityType: "AvanceSalaire",
    metadata: { statut },
  })

  return NextResponse.json(avance)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.avanceSalaire.delete({ where: { id } })

  await logActivity({
    session,
    action: "DELETE",
    module: "SALAIRES",
    description: `Suppression d'une avance sur salaire`,
    entityId: id,
    entityType: "AvanceSalaire",
  })

  return NextResponse.json({ ok: true })
}
