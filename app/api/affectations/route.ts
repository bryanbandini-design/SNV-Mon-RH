import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to   = searchParams.get("to")

  if (!from || !to) {
    return NextResponse.json({ message: "Paramètres from et to requis" }, { status: 400 })
  }

  const fromDate = new Date(from + "T00:00:00")
  const toDate   = new Date(to   + "T23:59:59")

  const [affectations, presences] = await Promise.all([
    prisma.affectationShift.findMany({
      where: {
        dateDebut: { lte: toDate },
        dateFin:   { gte: fromDate },
      },
      include: {
        employe: { select: { id: true, prenom: true, nom: true, poste: true } },
        shift:   true,
      },
      orderBy: { dateDebut: "asc" },
    }),
    prisma.presence.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
      },
      include: {
        employe: { select: { id: true, prenom: true, nom: true, matricule: true } },
      },
    }),
  ])

  return NextResponse.json({ affectations, presences }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  })
}

// POST: Create manual shift assignment for one employee
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { employeId, shiftId, dateDebut, dateFin } = await req.json()
  if (!employeId || !shiftId || !dateDebut || !dateFin) {
    return NextResponse.json({ message: "Champs requis manquants" }, { status: 400 })
  }

  const affectation = await prisma.affectationShift.create({
    data: {
      employeId,
      shiftId,
      dateDebut: new Date(dateDebut + "T00:00:00"),
      dateFin:   new Date(dateFin   + "T23:59:59"),
    },
    include: {
      employe: { select: { id: true, prenom: true, nom: true, poste: true } },
      shift:   true,
    },
  })

  return NextResponse.json(affectation, { status: 201 })
}

// DELETE: Remove a specific affectation by id (query param)
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ message: "id requis" }, { status: 400 })

  await prisma.affectationShift.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
