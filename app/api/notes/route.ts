import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/notes?dossierId=xxx
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dossierId = searchParams.get("dossierId")
  if (!dossierId) return NextResponse.json([])

  const notes = await prisma.noteInterne.findMany({
    where: { dossierId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(notes)
}

// POST /api/notes
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string
  const data   = await req.json()

  if (!data.dossierId || !data.contenu?.trim()) {
    return NextResponse.json({ message: "Données invalides" }, { status: 400 })
  }

  const note = await prisma.noteInterne.create({
    data: {
      dossierId: data.dossierId,
      auteurId:  userId,
      auteurNom: session.user?.name ?? "Inconnu",
      contenu:   data.contenu.trim(),
    },
  })

  // Log audit
  await prisma.auditLog.create({
    data: {
      dossierId:   data.dossierId,
      auteurId:    userId,
      auteurNom:   session.user?.name ?? "Inconnu",
      type:        "NOTE",
      description: `Note interne ajoutée par ${session.user?.name}`,
    },
  })

  return NextResponse.json(note, { status: 201 })
}

// DELETE /api/notes?id=xxx
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ message: "id requis" }, { status: 400 })

  await prisma.noteInterne.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
