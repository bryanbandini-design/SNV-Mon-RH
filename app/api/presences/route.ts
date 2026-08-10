import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes, calculerHS } from "@/lib/utils"
import { creerRetenueProvisoire, calculerRetenueRetard } from "@/lib/retenues"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const employeId = searchParams.get("employeId")
  const manuel = searchParams.get("manuel") // "pending" pour les saisies manuelles en attente

  const where: Record<string, unknown> = {}
  if (date) {
    const start = new Date(date + "T00:00:00")
    const end   = new Date(date + "T00:00:00")
    end.setDate(end.getDate() + 1)
    where.date = { gte: start, lt: end }
  }
  if (employeId) where.employeId = employeId
  if (manuel === "pending") {
    where.saisieManuelle = true
    where.statutValidation = "EN_ATTENTE"
  } else if (manuel === "all") {
    where.saisieManuelle = true
  }

  const presences = await prisma.presence.findMany({
    where,
    include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true } } },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(presences)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()

  // Calcul des heures travaillées, retard, et heures supplémentaires
  let heuresTravaillees: number | null = null
  let minutesRetard = 0
  let heuresSupBrutes = 0
  let statutHeuresSup = "N/A"

  // heureDebutShiftRef peut arriver sous deux noms selon la source du formulaire
  const heureDebutRef: string | null = data.heureDebutShiftRef ?? data.heureReferenceDebut ?? null

  if (data.heureArrivee && data.heureDepart) {
    const dow       = new Date(data.date).getUTCDay()
    const isWeekend = dow === 0 || dow === 6
    const hs = calculerHS({
      heureArrivee:       data.heureArrivee,
      heureDepart:        data.heureDepart,
      heureDebutShiftRef: heureDebutRef,
      heureFinShiftRef:   data.heureFinShiftRef ?? null,
      isWeekend,
    })
    heuresTravaillees = hs.heuresTravaillees
    heuresSupBrutes   = hs.heuresSupBrutes
    statutHeuresSup   = hs.statutHeuresSup
  }

  if (data.heureArrivee && heureDebutRef) {
    const arrivee   = heureEnMinutes(data.heureArrivee)
    const reference = heureEnMinutes(heureDebutRef)
    minutesRetard = Math.max(0, arrivee - reference)
  }

  const statut = data.statut ?? (minutesRetard > 0 ? "RETARD" : "PRESENT")

  const isManuel = data.saisieManuelle === true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any)?.role as string | undefined
  const isAdminOrRH = role === "ADMIN" || role === "RH"

  const presence = await prisma.presence.create({
    data: {
      employeId: data.employeId,
      date: new Date(data.date),
      heureArrivee: data.heureArrivee || null,
      heureDepart: data.heureDepart || null,
      heuresTravaillees,
      minutesRetard,
      statut,
      notes: data.notes || null,
      saisieManuelle: isManuel,
      statutValidation: isAdminOrRH ? "VALIDEE" : (isManuel ? "EN_ATTENTE" : "VALIDEE"),
      saisieParNom: data.saisieParNom || null,
      motifManuel: data.motifManuel || null,
      heuresSupBrutes,
      statutHeuresSup,
      heureDebutShiftRef: heureDebutRef || null,
      heureFinShiftRef: data.heureFinShiftRef || null,
    },
  })

  // Retenue provisoire automatique
  if (statut === "ABSENT") {
    await creerRetenueProvisoire({
      employeId: data.employeId,
      presenceId: presence.id,
      type: "ABSENCE",
      date: new Date(data.date),
      montant: 5_000,
      description: "Absence non justifiée",
    })
  } else if (minutesRetard > 0) {
    const employe = await prisma.employe.findUnique({
      where: { id: data.employeId },
      select: { salaireBase: true },
    })
    if (employe) {
      const montant = calculerRetenueRetard(minutesRetard, employe.salaireBase)
      if (montant > 0) {
        await creerRetenueProvisoire({
          employeId: data.employeId,
          presenceId: presence.id,
          type: "RETARD",
          date: new Date(data.date),
          montant,
          description: `${minutesRetard} min de retard`,
        })
      }
    }
  }

  return NextResponse.json(presence, { status: 201 })
}
