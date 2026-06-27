import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes } from "@/lib/utils"
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

  // Calcul des heures travaillées et du retard
  let heuresTravaillees: number | null = null
  let minutesRetard = 0

  if (data.heureArrivee && data.heureDepart) {
    const debut = heureEnMinutes(data.heureArrivee)
    const fin = heureEnMinutes(data.heureDepart)
    heuresTravaillees = Math.max(0, (fin - debut)) / 60
  }

  if (data.heureArrivee && data.heureReferenceDebut) {
    const arrivee = heureEnMinutes(data.heureArrivee)
    const reference = heureEnMinutes(data.heureReferenceDebut)
    minutesRetard = Math.max(0, arrivee - reference)
  }

  const statut = data.statut ?? (minutesRetard > 0 ? "RETARD" : "PRESENT")

  const isManuel = data.saisieManuelle === true

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
      statutValidation: isManuel ? "EN_ATTENTE" : "VALIDEE",
      saisieParNom: data.saisieParNom || null,
      motifManuel: data.motifManuel || null,
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
