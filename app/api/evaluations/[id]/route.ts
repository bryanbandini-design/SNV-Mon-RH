import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const { statut } = await req.json()

  const evaluation = await prisma.evaluation.update({
    where: { id },
    data: { statut },
    include: {
      employe: {
        select: {
          prenom: true, nom: true,
          utilisateur: { select: { id: true } },
        },
      },
    },
  })

  // Notifier l'employé quand l'évaluation est publiée
  if (statut === "PUBLIE") {
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
