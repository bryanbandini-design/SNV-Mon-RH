import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes } from "@/lib/utils"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const employeId = searchParams.get("employeId")

  const where: Record<string, unknown> = {}
  if (date) where.date = new Date(date)
  if (employeId) where.employeId = employeId

  const presences = await prisma.presence.findMany({
    where,
    include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true } } },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(presences)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()

  // Calcul des heures travaillées et du retard
  let heuresTravaillees: number | null = null
  let minutesRetard = 0

  if (data.heureArrivee && data.heureDepart) {
    const debut = heureEnMinutes(data.heureArrivee)
    const fin = heureEnMinutes(data.heureDepart)
    heuresTravaillees = Math.max(0, (fin - debut)) / 60
  }

  if (data.heureArrivee && data.heureReferenceDebut) {
    const arrivee = heureEnMinutes(data.heureArrivee)
    const reference = heureEnMinutes(data.heureReferenceDebut)
    minutesRetard = Math.max(0, arrivee - reference)
  }

  const statut = data.statut ?? (minutesRetard > 0 ? "RETARD" : "PRESENT")

  const presence = await prisma.presence.create({
    data: {
      employeId: data.employeId,
      date: new Date(data.date),
      heureArrivee: data.heureArrivee || null,
      heureDepart: data.heureDepart || null,
      heuresTravaillees,
      minutesRetard,
      statut,
      notes: data.notes || null,
    },
  })

  return NextResponse.json(presence, { status: 201 })
}
