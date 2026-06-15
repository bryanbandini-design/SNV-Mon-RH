import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes } from "@/lib/utils"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const data = await req.json()

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

  const presence = await prisma.presence.update({
    where: { id },
    data: {
      heureArrivee: data.heureArrivee || null,
      heureDepart: data.heureDepart || null,
      heuresTravaillees,
      minutesRetard,
      statut: data.statut ?? (minutesRetard > 0 ? "RETARD" : "PRESENT"),
      notes: data.notes || null,
    },
  })

  return NextResponse.json(presence)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.presence.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
