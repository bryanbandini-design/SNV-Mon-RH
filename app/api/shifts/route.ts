import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const shifts = await prisma.shift.findMany({ orderBy: { nom: "asc" } })
  return NextResponse.json(shifts)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()
  const shift = await prisma.shift.create({
    data: {
      nom: data.nom,
      heureDebut: data.heureDebut,
      heureFin: data.heureFin,
      couleur: data.couleur ?? "#3b82f6",
      description: data.description || null,
    },
  })
  return NextResponse.json(shift, { status: 201 })
}
