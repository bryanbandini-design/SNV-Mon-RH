import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { MOIS } from "@/lib/utils"
import { calculerSalaire } from "@/lib/cameroun-salaire"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const salaires = await prisma.historiqueSalaire.findMany({
    include: { employe: { select: { id: true, prenom: true, nom: true, matricule: true, poste: true } } },
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
  })
  return NextResponse.json(salaires, {
    headers: { "Cache-Control": "private, no-cache" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data        = await req.json()
  const salaireBase = parseFloat(data.salaireBase) || 0
  const primes      = parseFloat(data.primes ?? 0)  || 0
  const retenues    = parseFloat(data.retenues ?? 0) || 0

  const calcul = calculerSalaire(salaireBase, primes, retenues)

  const salaire = await prisma.historiqueSalaire.create({
    data: {
      employeId:     data.employeId,
      mois:          parseInt(data.mois),
      annee:         parseInt(data.annee),
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
      statut:        "EN_ATTENTE",
      notes:         data.notes || null,
    },
    include: { employe: { select: { prenom: true, nom: true } } },
  })

  const moisLabel = MOIS[salaire.mois - 1] ?? `Mois ${salaire.mois}`
  await logActivity({
    session,
    action:      "CREATE",
    module:      "SALAIRES",
    description: `Fiche créée — ${salaire.employe.prenom} ${salaire.employe.nom} · ${moisLabel} ${salaire.annee} · Net : ${calcul.netAPayer.toLocaleString("fr-FR")} FCFA`,
    entityId:    salaire.id,
    entityType:  "Salaire",
    metadata:    { mois: salaire.mois, annee: salaire.annee, netAPayer: calcul.netAPayer },
  })

  return NextResponse.json(salaire, { status: 201 })
}
