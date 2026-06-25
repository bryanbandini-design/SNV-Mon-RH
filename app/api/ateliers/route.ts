import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const ateliers = await prisma.atelier.findMany({
      where: { actif: true },
      orderBy: { nom: "asc" },
    })
    return NextResponse.json(ateliers, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    })
  } catch (err) {
    console.error("[ateliers GET]", err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: Request) {
  try {
    const { nom, code, couleur } = await req.json()
    if (!nom || !code) {
      return NextResponse.json({ error: "nom et code requis" }, { status: 400 })
    }

    const atelier = await prisma.atelier.create({
      data: { nom, code: code.toUpperCase().replace(/\s+/g, "_"), couleur: couleur ?? "#3b82f6" },
    })
    return NextResponse.json(atelier, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Ce code d'atelier existe déjà" }, { status: 409 })
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

  await prisma.atelier.update({ where: { id }, data: { actif: false } })
  return NextResponse.json({ success: true })
}
