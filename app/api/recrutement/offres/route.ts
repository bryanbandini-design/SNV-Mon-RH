import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireRole } from "@/lib/auth-guards"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const offres = await prisma.offre.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidats: true } } },
  })
  return NextResponse.json(offres, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  })
}

export async function POST(req: Request) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const data = await req.json()
  const offre = await prisma.offre.create({
    data: {
      titre:            data.titre,
      departement:      data.departement      || null,
      typeContrat:      data.typeContrat      || "CDI",
      localisation:     data.localisation     || null,
      description:      data.description      || null,
      salaireFourchette: data.salaireFourchette || null,
      statut:           data.statut           || "OUVERTE",
      priorite:         data.priorite         || "NORMALE",
      dateCloture:      data.dateCloture ? new Date(data.dateCloture) : null,
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "CREATE", module: "RECRUTEMENT", description: `Offre créée : ${offre.titre}`, entityId: offre.id, entityType: "Offre" })
  return NextResponse.json(offre, { status: 201 })
}
