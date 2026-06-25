import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId
  if (!session || !employeId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mois = searchParams.get("mois") // "YYYY-MM"

  let dateFilter: Record<string, unknown> = {}
  if (mois) {
    const [year, month] = mois.split("-").map(Number)
    dateFilter = { date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
  } else {
    const since = new Date()
    since.setDate(since.getDate() - 30)
    dateFilter = { date: { gte: since } }
  }

  const presences = await prisma.presence.findMany({
    where: { employeId, saisieManuelle: true, ...dateFilter },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(presences)
}

export async function POST(req: Request) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any
  const employeId = user?.employeId
  if (!session || !employeId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()
  if (!data.heureArrivee) return NextResponse.json({ message: "L'heure d'arrivée est requise" }, { status: 400 })

  const dateStr = data.date ?? new Date().toISOString().split("T")[0]
  const dateStart = new Date(dateStr + "T00:00:00")
  const dateEnd   = new Date(dateStr + "T00:00:00")
  dateEnd.setDate(dateEnd.getDate() + 1)

  const existing = await prisma.presence.findFirst({
    where: { employeId, saisieManuelle: true, date: { gte: dateStart, lt: dateEnd } },
  })
  if (existing) return NextResponse.json({ message: "Un pointage existe déjà pour cette date" }, { status: 409 })

  const presence = await prisma.presence.create({
    data: {
      employeId,
      date: new Date(dateStr + "T12:00:00"),
      heureArrivee:    data.heureArrivee,
      heureDepart:     data.heureDepart || null,
      statut:          "PRESENT",
      saisieManuelle:  true,
      statutValidation: "EN_ATTENTE",
      saisieParNom:    user?.name ?? null,
      notes:           data.notes || null,
    },
  })
  return NextResponse.json(presence, { status: 201 })
}
