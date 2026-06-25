import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const documents = await prisma.document.findMany({
    where: {
      employeId,
      dossierDisciplinaireId: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nom: true, type: true, url: true,
      taille: true, mimeType: true, createdAt: true,
    },
  })

  return NextResponse.json({ documents }, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
  })
}
