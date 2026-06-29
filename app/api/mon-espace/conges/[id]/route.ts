import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const { id } = await params

  const conge = await prisma.conge.findUnique({ where: { id } })
  if (!conge || conge.employeId !== employeId)
    return NextResponse.json({ message: "Demande introuvable" }, { status: 404 })

  if (conge.statut !== "EN_ATTENTE")
    return NextResponse.json({ message: "Seules les demandes en attente peuvent être annulées" }, { status: 403 })

  await prisma.conge.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
