import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const retenues = await prisma.retenueAbsence.findMany({
    where: { employeId },
    include: {
      presence: { select: { date: true, heureArrivee: true, minutesRetard: true, statut: true } },
    },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(retenues)
}
