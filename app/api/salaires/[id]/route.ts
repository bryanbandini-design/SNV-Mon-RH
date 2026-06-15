import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Simple statut update (marquer payé)
  if (body.statut && Object.keys(body).length === 1) {
    const salaire = await prisma.historiqueSalaire.update({
      where: { id },
      data: {
        statut: body.statut,
        datePaiement: body.statut === "PAYE" ? new Date() : null,
      },
    })
    return NextResponse.json(salaire)
  }

  // Full edit
  const { mois, annee, salaireBase, primes, retenues, notes } = body
  const base   = parseFloat(salaireBase)
  const prime  = parseFloat(primes  ?? "0")
  const retenu = parseFloat(retenues ?? "0")
  const net    = base + prime - retenu

  const salaire = await prisma.historiqueSalaire.update({
    where: { id },
    data: {
      mois:         parseInt(mois),
      annee:        parseInt(annee),
      salaireBase:  base,
      primes:       prime,
      retenues:     retenu,
      netAPayer:    net,
      notes:        notes || null,
    },
  })

  return NextResponse.json(salaire)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.historiqueSalaire.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
