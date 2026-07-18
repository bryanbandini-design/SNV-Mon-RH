import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"

export async function GET() {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const declarations = await prisma.declarationPeriode.findMany({
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
  })
  return NextResponse.json(declarations)
}
