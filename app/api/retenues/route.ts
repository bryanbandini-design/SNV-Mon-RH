import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statut     = searchParams.get("statut")     // EN_ATTENTE | VALIDEE | ANNULEE
  const employeId  = searchParams.get("employeId")
  const mois       = searchParams.get("mois")        // "YYYY-MM"

  const where: Record<string, unknown> = {}
  if (statut)    where.statut    = statut
  if (employeId) where.employeId = employeId
  if (mois) {
    const [y, m] = mois.split("-").map(Number)
    where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
  }

  const retenues = await prisma.retenueAbsence.findMany({
    where,
    include: {
      employe: { select: { id: true, prenom: true, nom: true, matricule: true, poste: true, salaireBase: true } },
      presence: { select: { id: true, date: true, heureArrivee: true, heureDepart: true, minutesRetard: true, statut: true } },
    },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(retenues)
}
