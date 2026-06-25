import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const annonces = await prisma.annonce.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  return NextResponse.json(annonces, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { titre, contenu, type } = await req.json()
  if (!titre || !contenu) {
    return NextResponse.json({ message: "Titre et contenu requis" }, { status: 400 })
  }

  const auteur = session.user?.name ?? "Administrateur"
  const annonce = await prisma.annonce.create({
    data: { titre, contenu, type: type || "INFO", auteur },
  })

  return NextResponse.json(annonce, { status: 201 })
}
