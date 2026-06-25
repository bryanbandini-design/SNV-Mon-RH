import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const avances = await prisma.avanceSalaire.findMany({
    include: { employe: { select: { id: true, prenom: true, nom: true, matricule: true, poste: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(avances, {
    headers: { "Cache-Control": "private, no-cache" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { employeId, montant, motif, date } = await req.json()
  if (!employeId || !montant) {
    return NextResponse.json({ message: "employeId et montant requis" }, { status: 400 })
  }

  const avance = await prisma.avanceSalaire.create({
    data: {
      employeId,
      montant: parseFloat(montant),
      motif: motif || null,
      date: date ? new Date(date) : new Date(),
      statut: "EN_ATTENTE",
    },
    include: { employe: { select: { prenom: true, nom: true } } },
  })

  await logActivity({
    session,
    action: "CREATE",
    module: "SALAIRES",
    description: `Avance sur salaire enregistrée — ${avance.employe.prenom} ${avance.employe.nom} · ${avance.montant.toLocaleString("fr-FR")} FCFA`,
    entityId: avance.id,
    entityType: "AvanceSalaire",
    metadata: { montant: avance.montant, employeId },
  })

  return NextResponse.json(avance, { status: 201 })
}
