import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes } from "@/lib/utils"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId
  if (!session || !employeId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const existing = await prisma.presence.findUnique({ where: { id } })
  if (!existing || existing.employeId !== employeId)
    return NextResponse.json({ message: "Non trouvé" }, { status: 404 })

  if (existing.statutValidation === "VALIDEE")
    return NextResponse.json({ message: "Ce pointage est déjà validé, impossible de le modifier" }, { status: 403 })

  const heureArrivee = existing.heureArrivee
  const heureDepart  = data.heureDepart ?? existing.heureDepart

  // Recalcul des heures travaillées dès qu'on a arrivée + départ
  let heuresTravaillees: number | null = existing.heuresTravaillees
  if (heureArrivee && heureDepart) {
    const debut = heureEnMinutes(heureArrivee)
    const fin   = heureEnMinutes(heureDepart)
    heuresTravaillees = Math.max(0, fin - debut) / 60
  }

  const presence = await prisma.presence.update({
    where: { id },
    data: {
      heureDepart,
      heuresTravaillees,
      notes: data.notes !== undefined ? (data.notes || null) : existing.notes,
    },
  })
  return NextResponse.json(presence)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId
  if (!session || !employeId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.presence.findUnique({ where: { id } })
  if (!existing || existing.employeId !== employeId)
    return NextResponse.json({ message: "Non trouvé" }, { status: 404 })

  if (existing.statutValidation === "VALIDEE")
    return NextResponse.json({ message: "Impossible de supprimer un pointage validé" }, { status: 403 })

  await prisma.presence.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
