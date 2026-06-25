import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const conges = await prisma.conge.findMany({
    include: { employe: { select: { prenom: true, nom: true, matricule: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(conges, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()

  const dateDebut = new Date(data.dateDebut)
  const dateFin = new Date(data.dateFin)
  const diffMs = dateFin.getTime() - dateDebut.getTime()
  const nbJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1

  const conge = await prisma.conge.create({
    data: {
      employeId: data.employeId,
      type: data.type,
      dateDebut,
      dateFin,
      nbJours,
      motif: data.motif || null,
      statut: "EN_ATTENTE",
    },
    include: { employe: { select: { prenom: true, nom: true } } },
  })

  await logActivity({
    session,
    action: "CREATE",
    module: "CONGES",
    description: `Demande de congé ${conge.type} pour ${conge.employe.prenom} ${conge.employe.nom} — ${nbJours} jour(s)`,
    entityId: conge.id,
    entityType: "Conge",
    metadata: { type: conge.type, nbJours, dateDebut: data.dateDebut, dateFin: data.dateFin },
  })

  return NextResponse.json(conge, { status: 201 })
}
