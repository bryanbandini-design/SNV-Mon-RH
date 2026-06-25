/**
 * GET  /api/zkteco/employes   — liste des employés avec leur PIN ZKTeco
 * PATCH /api/zkteco/employes  — assigner un PIN ZKTeco à un employé
 * Body: { employeId, zktecoPin }
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const employes = await prisma.employe.findMany({
    where:   { statut: "ACTIF" },
    select:  { id: true, prenom: true, nom: true, matricule: true, poste: true, zktecoPin: true },
    orderBy: { nom: "asc" },
  })

  return NextResponse.json(employes)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { employeId, zktecoPin } = await req.json()

  if (!employeId) return NextResponse.json({ message: "employeId requis" }, { status: 400 })

  // Vérifier unicité du PIN
  if (zktecoPin) {
    const existing = await prisma.employe.findFirst({
      where: { zktecoPin, id: { not: employeId } },
    })
    if (existing) {
      return NextResponse.json(
        { message: `PIN ${zktecoPin} déjà attribué à ${existing.prenom} ${existing.nom}` },
        { status: 409 }
      )
    }
  }

  const employe = await prisma.employe.update({
    where: { id: employeId },
    data:  { zktecoPin: zktecoPin || null },
    select: { id: true, prenom: true, nom: true, zktecoPin: true },
  })

  return NextResponse.json(employe)
}
