import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const [employe, salaires] = await Promise.all([
    prisma.employe.findUnique({
      where: { id: employeId },
      select: { prenom: true, nom: true, matricule: true, poste: true, salaireBase: true },
    }),
    prisma.historiqueSalaire.findMany({
      where:   { employeId },
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
    }),
  ])

  return NextResponse.json({ employe, salaires }, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
  })
}
