import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const employes = await prisma.employe.findMany({
    select: {
      id: true,
      prenom: true,
      nom: true,
      matricule: true,
      poste: true,
      departement: true,
      statut: true,
      dossiersDisciplinaires: {
        orderBy: { date: "desc" },
        include: {
          initiateur: { select: { name: true } },
          documents:  { select: { id: true, nom: true, type: true, url: true, createdAt: true } },
        },
      },
    },
    where: {
      dossiersDisciplinaires: { some: {} },
    },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  })

  return NextResponse.json(employes)
}
