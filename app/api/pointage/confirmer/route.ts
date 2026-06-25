import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// POST /api/pointage/confirmer
// Appelé depuis la page QR de l'atelier, après scan QR atelier + reconnaissance faciale
// Body: { pointageId, atelierCode, faceDescriptor (Float32Array[128] sérialisé en JSON array), faceScore }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pointageId, atelierCode, faceDescriptor, faceScore, employeId } = body as {
      pointageId?: string
      atelierCode: string
      faceDescriptor?: number[]
      faceScore?: number
      employeId?: string
    }

    // Trouver l'atelier par son code
    const atelier = await prisma.atelier.findUnique({ where: { code: atelierCode } })
    if (!atelier) {
      return NextResponse.json({ error: "Atelier inconnu" }, { status: 404 })
    }

    // Si on a un pointageId existant (employé déjà scanné à l'entrée)
    if (pointageId) {
      const pointage = await prisma.pointage.findUnique({ where: { id: pointageId } })
      if (!pointage) {
        return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 })
      }

      const faceOk = faceScore !== undefined ? faceScore < 0.5 : false // seuil face-api : < 0.5 = match
      const updated = await prisma.pointage.update({
        where: { id: pointageId },
        data: {
          atelierId: atelier.id,
          faceVerified: faceOk,
          faceScore,
          statut: faceOk ? "CONFIRME" : "FACE_ECHEC",
        },
        include: {
          employe: { select: { prenom: true, nom: true, photoUrl: true } },
          atelier: true,
        },
      })

      await logActivity({
        action: "POINTAGE_CONFIRME",
        module: "POINTAGE",
        description: `Présence confirmée : ${updated.employe.prenom} ${updated.employe.nom} → ${atelier.nom} (face ${faceOk ? "OK" : "échouée"})`,
        entityId: pointageId,
        entityType: "Pointage",
        metadata: { atelierCode, faceScore, faceOk },
      })

      return NextResponse.json({ success: true, pointage: updated, faceOk })
    }

    // Sinon : identification par le visage (scan atelier sans pointage préalable)
    // On cherche l'employé via employeId transmis après face-reco côté client
    if (!employeId) {
      return NextResponse.json({ error: "employeId requis sans pointageId" }, { status: 400 })
    }

    const employe = await prisma.employe.findUnique({ where: { id: employeId } })
    if (!employe) {
      return NextResponse.json({ error: "Employé introuvable" }, { status: 404 })
    }

    const faceOk = faceScore !== undefined ? faceScore < 0.5 : false
    const pointage = await prisma.pointage.create({
      data: {
        employeId,
        atelierId: atelier.id,
        faceVerified: faceOk,
        faceScore,
        statut: faceOk ? "CONFIRME" : "FACE_ECHEC",
      },
      include: {
        employe: { select: { prenom: true, nom: true, photoUrl: true } },
        atelier: true,
      },
    })

    return NextResponse.json({ success: true, pointage, faceOk })
  } catch (err) {
    console.error("[pointage/confirmer]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
