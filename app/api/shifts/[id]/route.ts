import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const shift = await prisma.shift.update({
    where: { id },
    data: {
      nom: data.nom,
      heureDebut: data.heureDebut,
      heureFin: data.heureFin,
      couleur: data.couleur,
      description: data.description || null,
    },
  })
  return NextResponse.json(shift)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.shift.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
