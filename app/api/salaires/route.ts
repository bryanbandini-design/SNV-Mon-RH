import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const salaires = await prisma.historiqueSalaire.findMany({
    include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true } } },
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
  })
  return NextResponse.json(salaires)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()
  const salaireBase = parseFloat(data.salaireBase)
  const primes = parseFloat(data.primes ?? 0)
  const retenues = parseFloat(data.retenues ?? 0)
  const netAPayer = salaireBase + primes - retenues

  const salaire = await prisma.historiqueSalaire.create({
    data: {
      employeId: data.employeId,
      mois: parseInt(data.mois),
      annee: parseInt(data.annee),
      salaireBase,
      primes,
      retenues,
      netAPayer,
      statut: "EN_ATTENTE",
      notes: data.notes || null,
    },
  })

  return NextResponse.json(salaire, { status: 201 })
}
