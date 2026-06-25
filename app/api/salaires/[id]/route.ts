import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculerSalaire } from "@/lib/cameroun-salaire"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const salaire = await prisma.historiqueSalaire.findUnique({
    where: { id },
    include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true } } },
  })
  if (!salaire) return NextResponse.json({ message: "Fiche introuvable" }, { status: 404 })
  return NextResponse.json(salaire)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const body   = await req.json()

  // Marquer payé / annuler paiement
  if (body.statut && Object.keys(body).length === 1) {
    const salaire = await prisma.historiqueSalaire.update({
      where: { id },
      data: {
        statut:       body.statut,
        datePaiement: body.statut === "PAYE" ? new Date() : null,
      },
    })
    return NextResponse.json(salaire)
  }

  // Modification complète avec recalcul Cameroun
  const salaireBase = parseFloat(body.salaireBase) || 0
  const primes      = parseFloat(body.primes  ?? "0") || 0
  const retenues    = parseFloat(body.retenues ?? "0") || 0

  const calcul = calculerSalaire(salaireBase, primes, retenues)

  const salaire = await prisma.historiqueSalaire.update({
    where: { id },
    data: {
      mois:          parseInt(body.mois),
      annee:         parseInt(body.annee),
      salaireBase,
      primes,
      retenues,
      brutImposable: calcul.brutImposable,
      cnpsSalarie:   calcul.cnpsSalarie,
      irpp:          calcul.irpp,
      cac:           calcul.cac,
      rav:           calcul.rav,
      cnpsPatronal:  calcul.cnpsPatronal,
      netAPayer:     calcul.netAPayer,
      notes:         body.notes || null,
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
