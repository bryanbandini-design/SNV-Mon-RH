import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeId = searchParams.get("employeId")
  const statut    = searchParams.get("statut")
  const type      = searchParams.get("type")

  const evaluations = await prisma.evaluation.findMany({
    where: {
      ...(employeId ? { employeId } : {}),
      ...(statut    ? { statut }    : {}),
      ...(type      ? { typeEvaluation: type } : {}),
    },
    include: {
      employe:   { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true } },
      notes:     { orderBy: { critere: "asc" } },
      objectifs: true,
      actions:   true,
    },
    orderBy: { dateEval: "desc" },
  })
  return NextResponse.json(evaluations, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()
  const notes: { critere: string; note: number; commentaire?: string; poids?: number }[] = data.notes ?? []
  const objectifs: { titre: string; description?: string; resultat?: string; atteint?: string }[] = data.objectifs ?? []
  const actions: { titre: string; type?: string; description?: string; echeance?: string; statut?: string }[] = data.actions ?? []

  const totalPoids = notes.reduce((a, n) => a + (n.poids ?? 1), 0)
  const scoreGlobal = notes.length > 0 && totalPoids > 0
    ? notes.reduce((acc, n) => acc + n.note * (n.poids ?? 1), 0) / totalPoids
    : 0

  const evaluation = await prisma.evaluation.create({
    data: {
      employeId:      data.employeId,
      typeEvaluation: data.typeEvaluation ?? "ANNUELLE",
      periode:        data.periode,
      dateEval:       new Date(data.dateEval),
      evaluateur:     data.evaluateur,
      scoreGlobal:    Math.round(scoreGlobal * 100) / 100,
      commentaire:    data.commentaire || null,
      recommandation: data.recommandation || null,
      statut:         data.statut ?? "BROUILLON",
      notes: {
        create: notes.map(n => ({
          critere:     n.critere,
          note:        n.note,
          commentaire: n.commentaire || null,
          poids:       n.poids ?? 1.0,
        })),
      },
      objectifs: {
        create: objectifs.map(o => ({
          titre:       o.titre,
          description: o.description || null,
          resultat:    o.resultat    || null,
          atteint:     o.atteint    ?? "EN_COURS",
        })),
      },
      actions: {
        create: actions.map(a => ({
          titre:       a.titre,
          type:        a.type     ?? "FORMATION",
          description: a.description || null,
          echeance:    a.echeance ? new Date(a.echeance) : null,
          statut:      a.statut   ?? "PLANIFIE",
        })),
      },
    },
    include: {
      notes:     true,
      objectifs: true,
      actions:   true,
      employe:   { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true } },
    },
  })

  return NextResponse.json(evaluation, { status: 201 })
}
