import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const CORS = {
  "Access-Control-Allow-Origin":  process.env.SANOVIA_URL ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control":                "public, s-maxage=60, stale-while-revalidate=300",
}

// OPTIONS — preflight CORS
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// GET — liste publique des offres ouvertes
export async function GET() {
  const offres = await prisma.offre.findMany({
    where:   { statut: "OUVERTE" },
    orderBy: [{ priorite: "desc" }, { dateOuverture: "desc" }],
    select: {
      id:                 true,
      titre:              true,
      departement:        true,
      typeContrat:        true,
      localisation:       true,
      description:        true,
      salaireFourchette:  true,
      priorite:           true,
      dateOuverture:      true,
      dateCloture:        true,
    },
  })

  return NextResponse.json(offres, { headers: CORS })
}
