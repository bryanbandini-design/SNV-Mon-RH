import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// POST /api/pointage/entree
// Body: { employeId, faceScore }
// La reconnaissance faciale se fait côté client avant d'appeler cette route
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { employeId, faceScore } = body as { employeId: string; faceScore?: number }

    if (!employeId) {
      return NextResponse.json({ error: "employeId requis" }, { status: 400 })
    }

    const employe = await prisma.employe.findUnique({ where: { id: employeId } })
    if (!employe) {
      return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })
    }

    const pointage = await prisma.pointage.create({
      data: {
        employeId,
        faceVerified: faceScore !== undefined ? faceScore < 0.5 : false,
        faceScore,
        statut: "EN_ATTENTE",
      },
    })

    await logActivity({
      action: "POINTAGE_ENTREE",
      module: "POINTAGE",
      description: `Arrivée enregistrée : ${employe.prenom} ${employe.nom} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
      entityId: pointage.id,
      entityType: "Pointage",
      metadata: { faceScore, employeId },
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

// GET /api/pointage/entree — pointages du jour
export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

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
