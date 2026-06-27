import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function POST(req: Request) {
  try {
    const { pointageId, atelierCode, employeId } = await req.json() as {
      pointageId?: string
      atelierCode: string
      employeId?: string
    }

    const atelier = await prisma.atelier.findUnique({ where: { code: atelierCode } })
    if (!atelier) return NextResponse.json({ error: "Atelier inconnu" }, { status: 404 })

    if (pointageId) {
      const pointage = await prisma.pointage.findUnique({ where: { id: pointageId } })
      if (!pointage) return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 })

      const updated = await prisma.pointage.update({
        where: { id: pointageId },
        data: { atelierId: atelier.id, statut: "CONFIRME" },
        include: {
          employe: { select: { prenom: true, nom: true, photoUrl: true } },
          atelier: true,
        },
      })

      await logActivity({
        action: "POINTAGE_CONFIRME",
        module: "POINTAGE",
        description: `Présence confirmée : ${updated.employe.prenom} ${updated.employe.nom} → ${atelier.nom}`,
        entityId: pointageId,
        entityType: "Pointage",
        metadata: { atelierCode },
      })

      return NextResponse.json({ success: true, pointage: updated })
    }

    if (!employeId) return NextResponse.json({ error: "employeId requis" }, { status: 400 })

    const employe = await prisma.employe.findUnique({ where: { id: employeId } })
    if (!employe) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })

    const pointage = await prisma.pointage.create({
      data: { employeId, atelierId: atelier.id, statut: "CONFIRME", source: "QR" },
      include: {
        employe: { select: { prenom: true, nom: true, photoUrl: true } },
        atelier: true,
      },
    })

    return NextResponse.json({ success: true, pointage })
  } catch (err) {
    console.error("[pointage/confirmer]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
