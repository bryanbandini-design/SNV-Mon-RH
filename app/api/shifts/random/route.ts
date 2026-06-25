import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { dateDebut, dateFin } = await req.json()
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ message: "dateDebut et dateFin requis" }, { status: 400 })
  }

  const [employes, shifts] = await Promise.all([
    prisma.employe.findMany({
      where: { statut: "ACTIF" },
      select: { id: true, utilisateur: { select: { role: true } } },
    }),
    prisma.shift.findMany({ orderBy: { nom: "asc" } }),
  ])

  if (shifts.length === 0) {
    return NextResponse.json({ message: "Aucun shift configuré" }, { status: 400 })
  }
  if (employes.length === 0) {
    return NextResponse.json({ message: "Aucun employé actif" }, { status: 400 })
  }

  // Sépare responsables (ADMIN / RESPONSABLE) des autres
  const responsables    = employes.filter(e => e.utilisateur?.role === "RESPONSABLE" || e.utilisateur?.role === "ADMIN")
  const nonResponsables = employes.filter(e => e.utilisateur?.role !== "RESPONSABLE" && e.utilisateur?.role !== "ADMIN")

  const shuffledResp = shuffle(responsables)
  const shuffledRest = shuffle(nonResponsables)

  const affectations: { employeId: string; shiftId: string; dateDebut: Date; dateFin: Date }[] = []
  const from = new Date(dateDebut)
  const to   = new Date(dateFin)

  // Garantir 1 responsable par shift (si disponibles)
  shifts.forEach((shift, i) => {
    const resp = shuffledResp[i % (shuffledResp.length || 1)]
    if (resp && shuffledResp.length > 0) {
      // Chaque responsable est affecté au shift i%len
      if (i < shuffledResp.length) {
        affectations.push({ employeId: resp.id, shiftId: shift.id, dateDebut: from, dateFin: to })
      }
    }
  })

  // Si plus de responsables que de shifts, les responsables restants s'ajoutent en round-robin
  if (shuffledResp.length > shifts.length) {
    shuffledResp.slice(shifts.length).forEach((resp, i) => {
      affectations.push({ employeId: resp.id, shiftId: shifts[i % shifts.length].id, dateDebut: from, dateFin: to })
    })
  }

  // Répartit les non-responsables en round-robin
  shuffledRest.forEach((emp, i) => {
    affectations.push({ employeId: emp.id, shiftId: shifts[i % shifts.length].id, dateDebut: from, dateFin: to })
  })

  // Supprime les affectations existantes sur cette période
  await prisma.affectationShift.deleteMany({
    where: {
      OR: [
        { dateDebut: { gte: from, lte: to } },
        { dateFin:   { gte: from, lte: to } },
        { dateDebut: { lte: from }, dateFin: { gte: to } },
      ],
    },
  })

  await prisma.affectationShift.createMany({ data: affectations })

  const result = await prisma.affectationShift.findMany({
    where: {
      OR: [
        { dateDebut: { gte: from, lte: to } },
        { dateFin:   { gte: from, lte: to } },
        { dateDebut: { lte: from }, dateFin: { gte: to } },
      ],
    },
    include: {
      employe: {
        select: {
          prenom: true, nom: true, poste: true,
          utilisateur: { select: { role: true } },
        },
      },
      shift: true,
    },
    orderBy: { shift: { nom: "asc" } },
  })

  const nbShiftsSansResp = shifts.filter(s =>
    !result.some(a => a.shiftId === s.id && (a.employe.utilisateur?.role === "RESPONSABLE" || a.employe.utilisateur?.role === "ADMIN"))
  ).length

  return NextResponse.json({ affectations: result, nbShiftsSansResp }, { status: 201 })
}
