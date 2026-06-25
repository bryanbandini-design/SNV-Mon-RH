import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])

  const employes = await prisma.employe.findMany({
    where: {
      statut: "ACTIF",
      OR: [
        { prenom:    { contains: q } },
        { nom:       { contains: q } },
        { matricule: { contains: q } },
        { poste:     { contains: q } },
        { email:     { contains: q } },
      ],
    },
    select: { id: true, prenom: true, nom: true, matricule: true, poste: true, departement: true },
    take: 8,
    orderBy: { nom: "asc" },
  })

  return NextResponse.json(employes)
}
