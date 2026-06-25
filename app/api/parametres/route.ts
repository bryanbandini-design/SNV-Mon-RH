import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const DEFAULTS: Record<string, string> = {
  ENTREPRISE_NOM:        "Mon Entreprise",
  ENTREPRISE_ADRESSE:    "",
  ENTREPRISE_RCCM:       "",
  ENTREPRISE_NIU:        "",
  ENTREPRISE_TEL:        "",
  ENTREPRISE_EMAIL:      "",
  ENTREPRISE_DIRIGEANT:  "",
  CONGES_ANNUELS_DEFAUT: "24",
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const rows = await prisma.parametre.findMany()
  const params = { ...DEFAULTS, ...Object.fromEntries(rows.map(r => [r.cle, r.valeur])) }
  return NextResponse.json({ params }, {
    headers: { "Cache-Control": "private, max-age=600, stale-while-revalidate=1200" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!session || !["ADMIN", "RH"].includes((session.user as any)?.role)) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 })
  }

  const body: Record<string, string> = await req.json()
  await Promise.all(
    Object.entries(body).map(([cle, valeur]) =>
      prisma.parametre.upsert({
        where:  { cle },
        create: { cle, valeur },
        update: { valeur },
      })
    )
  )
  return NextResponse.json({ ok: true })
}
