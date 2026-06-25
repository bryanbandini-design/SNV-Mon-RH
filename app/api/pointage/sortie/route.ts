import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/pointage/sortie
// Body: { pointageId }
export async function POST(req: Request) {
  try {
    const { pointageId } = await req.json()

    if (!pointageId) {
      return NextResponse.json({ error: "pointageId requis" }, { status: 400 })
    }

    const pointage = await prisma.pointage.update({
      where: { id: pointageId },
      data: { dateSortie: new Date(), statut: "SORTI" },
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    return NextResponse.json({ success: true, pointage })
  } catch (err) {
    console.error("[pointage/sortie]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
