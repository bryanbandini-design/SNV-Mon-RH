import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireRole } from "@/lib/auth-guards"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const offreId = searchParams.get("offreId")

  const candidats = await prisma.candidat.findMany({
    where:   offreId ? { offreId } : {},
    orderBy: { createdAt: "desc" },
    include: { offre: { select: { titre: true } }, entretiens: { orderBy: { date: "asc" } } },
  })
  return NextResponse.json(candidats)
}

export async function POST(req: Request) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const data = await req.json()
  const candidat = await prisma.candidat.create({
    data: {
      offreId:    data.offreId,
      prenom:     data.prenom,
      nom:        data.nom,
      email:      data.email      || null,
      telephone:  data.telephone  || null,
      source:     data.source     || null,
      commentaire: data.commentaire || null,
      statut:     "RECU",
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "CREATE", module: "RECRUTEMENT", description: `Candidat ajouté : ${candidat.prenom} ${candidat.nom}`, entityId: candidat.id, entityType: "Candidat" })
  return NextResponse.json(candidat, { status: 201 })
}
