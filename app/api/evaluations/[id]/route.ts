import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      employe:   { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true, salaireBase: true } },
      notes:     { orderBy: { critere: "asc" } },
      objectifs: { orderBy: { createdAt: "asc" } },
      actions:   { orderBy: { createdAt: "asc" } },
    },
  })
  if (!evaluation) return NextResponse.json({ message: "Introuvable" }, { status: 404 })
  return NextResponse.json(evaluation)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Full edit (when body has notes field)
  if (body.notes !== undefined) {
    const notes     = body.notes     ?? []
    const objectifs = body.objectifs ?? []
    const actions   = body.actions   ?? []

    const totalPoids  = notes.reduce((a: number, n: { poids?: number }) => a + (n.poids ?? 1), 0)
    const scoreGlobal = notes.length > 0 && totalPoids > 0
      ? notes.reduce((acc: number, n: { note: number; poids?: number }) => acc + n.note * (n.poids ?? 1), 0) / totalPoids
      : 0

    // Delete existing nested records and recreate
    await prisma.noteEvaluation.deleteMany({ where: { evaluationId: id } })
    await prisma.objectifEvaluation.deleteMany({ where: { evaluationId: id } })
    await prisma.actionDeveloppement.deleteMany({ where: { evaluationId: id } })

    const evaluation = await prisma.evaluation.update({
      where: { id },
      data: {
        typeEvaluation: body.typeEvaluation ?? undefined,
        periode:        body.periode        ?? undefined,
        dateEval:       body.dateEval  ? new Date(body.dateEval) : undefined,
        evaluateur:     body.evaluateur     ?? undefined,
        scoreGlobal:    Math.round(scoreGlobal * 100) / 100,
        commentaire:    body.commentaire !== undefined ? (body.commentaire || null) : undefined,
        recommandation: body.recommandation !== undefined ? (body.recommandation || null) : undefined,
        statut:         body.statut         ?? undefined,
        notes: {
          create: notes.map((n: { critere: string; note: number; commentaire?: string; poids?: number }) => ({
            critere:     n.critere,
            note:        n.note,
            commentaire: n.commentaire || null,
            poids:       n.poids ?? 1.0,
          })),
        },
        objectifs: {
          create: objectifs.map((o: { titre: string; description?: string; resultat?: string; atteint?: string }) => ({
            titre:       o.titre,
            description: o.description || null,
            resultat:    o.resultat    || null,
            atteint:     o.atteint    ?? "EN_COURS",
          })),
        },
        actions: {
          create: actions.map((a: { titre: string; type?: string; description?: string; echeance?: string; statut?: string }) => ({
            titre:       a.titre,
            type:        a.type        ?? "FORMATION",
            description: a.description || null,
            echeance:    a.echeance ? new Date(a.echeance) : null,
            statut:      a.statut      ?? "PLANIFIE",
          })),
        },
      },
      include: {
        notes: true, objectifs: true, actions: true,
        employe: { select: { prenom: true, nom: true, utilisateur: { select: { id: true } } } },
      },
    })

    if (body.statut === "PUBLIE") {
      const empUser = evaluation.employe?.utilisateur
      if (empUser) {
        await prisma.notification.create({
          data: {
            userId:  empUser.id,
            type:    "EVALUATION_PUBLIEE",
            titre:   "Nouvelle évaluation disponible",
            message: `Votre évaluation pour la période « ${evaluation.periode} » vient d'être publiée. Score : ${evaluation.scoreGlobal.toFixed(1)}/5.`,
          },
        })
      }
    }

    return NextResponse.json(evaluation)
  }

  // Simple statut-only update
  const evaluation = await prisma.evaluation.update({
    where: { id },
    data: { statut: body.statut },
    include: {
      employe: { select: { prenom: true, nom: true, utilisateur: { select: { id: true } } } },
    },
  })

  if (body.statut === "PUBLIE") {
    const empUser = evaluation.employe?.utilisateur
    if (empUser) {
      await prisma.notification.create({
        data: {
          userId:  empUser.id,
          type:    "EVALUATION_PUBLIEE",
          titre:   "Nouvelle évaluation disponible",
          message: `Votre évaluation pour la période « ${evaluation.periode} » vient d'être publiée. Score : ${evaluation.scoreGlobal.toFixed(1)}/5.`,
        },
      })
    }
  }

  return NextResponse.json(evaluation)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.evaluation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
