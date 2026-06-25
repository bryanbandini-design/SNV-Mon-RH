import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/pointage/face — retourne tous les employés avec leur faceDescriptor pour la reco côté client
export async function GET() {
  const employes = await prisma.employe.findMany({
    where: { statut: "ACTIF", faceDescriptor: { not: null } },
    select: { id: true, prenom: true, nom: true, photoUrl: true, faceDescriptor: true },
  })

  return NextResponse.json(
    employes.map(e => ({
      id: e.id,
      prenom: e.prenom,
      nom: e.nom,
      photoUrl: e.photoUrl,
      descriptor: JSON.parse(e.faceDescriptor!),
    }))
  )
}

// POST /api/pointage/face — enregistre le faceDescriptor d'un employé
// Body: { employeId, descriptor: number[] }
export async function POST(req: Request) {
  try {
    const { employeId, descriptor } = await req.json()
    if (!employeId || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({ error: "employeId et descriptor[128] requis" }, { status: 400 })
    }

    await prisma.employe.update({
      where: { id: employeId },
      data: { faceDescriptor: JSON.stringify(descriptor) },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[pointage/face POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
