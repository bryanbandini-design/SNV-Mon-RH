import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireRole } from "@/lib/auth-guards"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count:        { select: { participations: true } },
      participations: {
        include: { employe: { select: { prenom: true, nom: true, poste: true } } },
      },
    },
  })
  return NextResponse.json(formations, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
  })
}

export async function POST(req: Request) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const data = await req.json()
  const formation = await prisma.formation.create({
    data: {
      titre:          data.titre,
      type:           data.type          || "INTERNE",
      organisme:      data.organisme      || null,
      description:    data.description   || null,
      dureeHeures:    data.dureeHeures   ? parseFloat(data.dureeHeures)   : null,
      cout:           data.cout           ? parseFloat(data.cout)           : null,
      dateDebut:      data.dateDebut      ? new Date(data.dateDebut)        : null,
      dateFin:        data.dateFin        ? new Date(data.dateFin)          : null,
      lieu:           data.lieu           || null,
      statut:         data.statut         || "PLANIFIE",
      maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants) : null,
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "CREATE", module: "FORMATIONS", description: `Formation créée : ${formation.titre}`, entityId: formation.id, entityType: "Formation" })
  return NextResponse.json(formation, { status: 201 })
}
