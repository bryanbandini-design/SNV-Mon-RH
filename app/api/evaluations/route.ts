import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const evaluations = await prisma.evaluation.findMany({
    include: {
      employe: { select: { prenom: true, nom: true, matricule: true, poste: true } },
      notes: true,
    },
    orderBy: { dateEval: "desc" },
  })
  return NextResponse.json(evaluations)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()
  const notes: { critere: string; note: number; commentaire?: string }[] = data.notes ?? []

  const scoreGlobal = notes.length > 0
    ? notes.reduce((acc, n) => acc + n.note, 0) / notes.length
    : 0

  const evaluation = await prisma.evaluation.create({
    data: {
      employeId: data.employeId,
      periode: data.periode,
      dateEval: new Date(data.dateEval),
      evaluateur: data.evaluateur,
      scoreGlobal: Math.round(scoreGlobal * 10) / 10,
      commentaire: data.commentaire || null,
      statut: data.statut ?? "BROUILLON",
      notes: {
        create: notes.map((n) => ({
          critere: n.critere,
          note: n.note,
          commentaire: n.commentaire || null,
        })),
      },
    },
    include: { notes: true, employe: { select: { prenom: true, nom: true } } },
  })

  return NextResponse.json(evaluation, { status: 201 })
}
