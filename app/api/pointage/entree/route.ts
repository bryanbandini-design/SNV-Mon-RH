import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function POST(req: Request) {
  try {
    const { employeId } = await req.json().catch(() => ({})) as { employeId?: string }
    if (!employeId) return NextResponse.json({ error: "employeId requis" }, { status: 400 })

    const employe = await prisma.employe.findUnique({ where: { id: employeId } })
    if (!employe) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })

    const pointage = await prisma.pointage.create({
      data: { employeId, statut: "EN_ATTENTE", source: "QR" },
    })

    await logActivity({
      action: "POINTAGE_ENTREE",
      module: "POINTAGE",
      description: `Arrivée enregistrée : ${employe.prenom} ${employe.nom} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
      entityId: pointage.id,
      entityType: "Pointage",
      metadata: { employeId },
    })

    return NextResponse.json({
      pointageId: pointage.id,
      dateEntree: pointage.dateEntree,
      employe: { prenom: employe.prenom, nom: employe.nom },
    })
  } catch (err) {
    console.error("[pointage/entree]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function GET() {
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

  const pointages = await prisma.pointage.findMany({
    where: { dateEntree: { gte: today, lt: tomorrow } },
    include: {
      employe: { select: { prenom: true, nom: true, poste: true, photoUrl: true } },
      atelier: true,
    },
    orderBy: { dateEntree: "desc" },
  })
  return NextResponse.json(pointages)
}
