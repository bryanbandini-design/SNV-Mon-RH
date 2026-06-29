import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculerSalaire, calculerHS } from "@/lib/cameroun-salaire"
import { calculerRetenueAbsence, calculerRetenueRetard } from "@/lib/retenues"
import { requireRole } from "@/lib/auth-guards"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  const salaire = await prisma.historiqueSalaire.findUnique({
    where: { id },
    include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true } } },
  })
  if (!salaire) return NextResponse.json({ message: "Fiche introuvable" }, { status: 404 })
  return NextResponse.json(salaire)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

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
  const salaireBase        = parseFloat(body.salaireBase) || 0
  const primes             = parseFloat(body.primes  ?? "0") || 0
  const retenues           = parseFloat(body.retenues ?? "0") || 0
  const nbHS               = parseFloat(body.heuresSupplementaires ?? "0") || 0
  const tauxHS             = (body.tauxHS as string) || "NORMAL"
  const montantHS          = nbHS > 0 ? calculerHS(salaireBase, nbHS, tauxHS as "NORMAL" | "ELEVE" | "DIMANCHE") : 0
  const joursAbsence       = parseInt(body.joursAbsence ?? "0") || 0
  const minutesRetardTotal  = parseInt(body.minutesRetardTotal ?? "0") || 0
  const retenueAbsence      = joursAbsence > 0 ? calculerRetenueAbsence(joursAbsence, salaireBase) : 0
  const retenueRetard       = minutesRetardTotal > 0 ? calculerRetenueRetard(minutesRetardTotal, salaireBase) : 0

  const calcul = calculerSalaire(salaireBase, primes, retenues + retenueAbsence + retenueRetard, montantHS)

  const salaire = await prisma.historiqueSalaire.update({
    where: { id },
    data: {
      mois:                  parseInt(body.mois),
      annee:                 parseInt(body.annee),
      salaireBase,
      primes,
      retenues,
      heuresSupplementaires: nbHS,
      montantHS,
      joursAbsence,
      retenueAbsence,
      minutesRetardTotal,
      retenueRetard,
      brutImposable:         calcul.brutImposable,
      cnpsSalarie:           calcul.cnpsSalarie,
      irpp:                  calcul.irpp,
      cac:                   calcul.cac,
      rav:                   calcul.rav,
      cnpsPatronal:          calcul.cnpsPatronal,
      netAPayer:             calcul.netAPayer,
      notes:                 body.notes || null,
    },
  })

  return NextResponse.json(salaire)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  await prisma.historiqueSalaire.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
