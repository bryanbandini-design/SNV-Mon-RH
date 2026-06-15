import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// Répartit aléatoirement les employés actifs entre tous les shifts disponibles
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { dateDebut, dateFin } = await req.json()

  const [employes, shifts] = await Promise.all([
    prisma.employe.findMany({ where: { statut: "ACTIF" }, select: { id: true } }),
    prisma.shift.findMany({ orderBy: { nom: "asc" } }),
  ])

  if (shifts.length === 0) {
    return NextResponse.json({ message: "Aucun shift configuré" }, { status: 400 })
  }

  // Mélange de Fisher-Yates
  const melange = [...employes].sort(() => Math.random() - 0.5)

  // Supprime les affectations existantes sur cette période
  await prisma.affectationShift.deleteMany({
    where: {
      dateDebut: { gte: new Date(dateDebut) },
      dateFin: { lte: new Date(dateFin) },
    },
  })

  // Répartition équilibrée round-robin
  const affectations = melange.map((emp, i) => ({
    employeId: emp.id,
    shiftId: shifts[i % shifts.length].id,
    dateDebut: new Date(dateDebut),
    dateFin: new Date(dateFin),
  }))

  await prisma.affectationShift.createMany({ data: affectations })

  // Retourne avec les détails
  const result = await prisma.affectationShift.findMany({
    where: { dateDebut: { gte: new Date(dateDebut) } },
    include: {
      employe: { select: { prenom: true, nom: true, poste: true } },
      shift: true,
    },
  })

  return NextResponse.json(result, { status: 201 })
}
