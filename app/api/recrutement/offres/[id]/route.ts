import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const offre = await prisma.offre.findUnique({
    where: { id },
    include: { _count: { select: { candidats: true } } },
  })
  if (!offre) return NextResponse.json({ message: "Offre introuvable" }, { status: 404 })
  return NextResponse.json(offre)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const data   = await req.json()

  const offre = await prisma.offre.update({
    where: { id },
    data: {
      ...(data.titre            !== undefined && { titre: data.titre }),
      ...(data.statut           !== undefined && { statut: data.statut }),
      ...(data.priorite         !== undefined && { priorite: data.priorite }),
      ...(data.departement      !== undefined && { departement: data.departement || null }),
      ...(data.typeContrat      !== undefined && { typeContrat: data.typeContrat }),
      ...(data.localisation     !== undefined && { localisation: data.localisation || null }),
      ...(data.description      !== undefined && { description: data.description || null }),
      ...(data.salaireFourchette !== undefined && { salaireFourchette: data.salaireFourchette || null }),
      ...(data.dateCloture       !== undefined && { dateCloture: data.dateCloture ? new Date(data.dateCloture) : null }),
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "UPDATE", module: "RECRUTEMENT", description: `Offre mise à jour : ${offre.titre}`, entityId: offre.id, entityType: "Offre" })
  return NextResponse.json(offre)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.offre.delete({ where: { id } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "DELETE", module: "RECRUTEMENT", description: "Offre supprimée", entityId: id, entityType: "Offre" })
  return NextResponse.json({ ok: true })
}
