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

  const now = new Date()

  // Plage du mois sélectionné (ou mois courant)
  let year  = now.getFullYear()
  let month = now.getMonth() + 1
  if (mois) {
    const parts = mois.split("-").map(Number)
    year  = parts[0]
    month = parts[1]
  }
  const debut = new Date(year, month - 1, 1)
  const fin   = new Date(year, month, 1)

  // Semaine courante (lundi → dimanche)
  const lundi = new Date(now)
  lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  lundi.setHours(0, 0, 0, 0)
  const dimanche = new Date(lundi)
  dimanche.setDate(lundi.getDate() + 7)

  const [presencesMois, presencesSemaine] = await Promise.all([
    prisma.presence.findMany({
      where: {
        employeId,
        statutValidation: "VALIDEE",
        date: { gte: debut, lt: fin },
      },
      orderBy: { date: "desc" },
    }),
    prisma.presence.findMany({
      where: {
        employeId,
        statutValidation: "VALIDEE",
        date: { gte: lundi, lt: dimanche },
      },
    }),
  ])

  const heuresMois    = presencesMois.reduce((s, p) => s + (p.heuresTravaillees ?? 0), 0)
  const heuresSemaine = presencesSemaine.reduce((s, p) => s + (p.heuresTravaillees ?? 0), 0)
  const joursPresents = presencesMois.filter(p => p.statut === "PRESENT" || p.statut === "RETARD").length
  const retards       = presencesMois.filter(p => p.statut === "RETARD").length

  return NextResponse.json({
    presences: presencesMois,
    stats: {
      heuresMois:    Math.round(heuresMois * 10) / 10,
      heuresSemaine: Math.round(heuresSemaine * 10) / 10,
      joursPresents,
      retards,
      moyenneParJour: joursPresents > 0
        ? Math.round((heuresMois / joursPresents) * 10) / 10
        : 0,
    },
  })
}
