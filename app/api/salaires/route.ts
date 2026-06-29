import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { MOIS } from "@/lib/utils"
import { calculerSalaire, calculerHS } from "@/lib/cameroun-salaire"
import { calculerRetenueAbsence, calculerRetenueRetard } from "@/lib/retenues"
import { requireRole } from "@/lib/auth-guards"

export async function GET() {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const salaires = await prisma.historiqueSalaire.findMany({
    include: { employe: { select: { id: true, prenom: true, nom: true, matricule: true, poste: true } } },
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
  })
  return NextResponse.json(salaires, {
    headers: { "Cache-Control": "private, no-cache" },
  })
}

export async function POST(req: Request) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const data        = await req.json()
  const salaireBase = parseFloat(data.salaireBase) || 0
  const primes      = parseFloat(data.primes ?? 0)  || 0
  const retenues    = parseFloat(data.retenues ?? 0) || 0
  const nbHS        = parseFloat(data.heuresSupplementaires ?? 0) || 0
  const tauxHS      = (data.tauxHS as string) || "NORMAL"
  const montantHS   = nbHS > 0 ? calculerHS(salaireBase, nbHS, tauxHS as "NORMAL" | "ELEVE" | "DIMANCHE") : 0

  const joursAbsence       = parseInt(data.joursAbsence ?? 0) || 0
  const minutesRetardTotal  = parseInt(data.minutesRetardTotal ?? 0) || 0
  const retenueAbsence      = joursAbsence > 0 ? calculerRetenueAbsence(joursAbsence, salaireBase) : 0
  const retenueRetard       = minutesRetardTotal > 0 ? calculerRetenueRetard(minutesRetardTotal, salaireBase) : 0

  // Avances validées non encore déduites pour cet employé
  const avancesValides = await prisma.avanceSalaire.findMany({
    where: { employeId: data.employeId, statut: "VALIDEE" },
  })
  const avanceDeduite = avancesValides.reduce((s, a) => s + a.montant, 0)

  const calcul = calculerSalaire(salaireBase, primes, retenues + retenueAbsence + retenueRetard + avanceDeduite, montantHS)

  const salaire = await prisma.historiqueSalaire.create({
    data: {
      employeId:            data.employeId,
      mois:                 parseInt(data.mois),
      annee:                parseInt(data.annee),
      salaireBase,
      primes,
      retenues,
      heuresSupplementaires: nbHS,
      montantHS,
      joursAbsence,
      retenueAbsence,
      minutesRetardTotal,
      retenueRetard,
      avanceDeduite,
      brutImposable:        calcul.brutImposable,
      cnpsSalarie:          calcul.cnpsSalarie,
      irpp:                 calcul.irpp,
      cac:                  calcul.cac,
      rav:                  calcul.rav,
      cnpsPatronal:         calcul.cnpsPatronal,
      netAPayer:            calcul.netAPayer,
      statut:               "EN_ATTENTE",
      notes:                data.notes || null,
    },
    include: { employe: { select: { prenom: true, nom: true } } },
  })

  // Marquer les avances comme DEDUITE et les lier à ce bulletin
  if (avancesValides.length > 0) {
    await prisma.avanceSalaire.updateMany({
      where: { id: { in: avancesValides.map(a => a.id) } },
      data:  { statut: "DEDUITE", bulletinId: salaire.id },
    })
  }

  const moisLabel = MOIS[salaire.mois - 1] ?? `Mois ${salaire.mois}`

  // Notifier l'employé que son bulletin est disponible
  const employeUser = await prisma.employe.findUnique({
    where:  { id: data.employeId },
    select: { utilisateur: { select: { id: true } } },
  })
  if (employeUser?.utilisateur) {
    await prisma.notification.create({
      data: {
        userId:  employeUser.utilisateur.id,
        type:    "BULLETIN_DISPONIBLE",
        titre:   "Bulletin de salaire disponible",
        message: `Votre bulletin de salaire ${moisLabel} ${salaire.annee} est disponible — Net à payer : ${Math.round(calcul.netAPayer).toLocaleString("fr-FR")} FCFA.`,
      },
    })
  }

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
