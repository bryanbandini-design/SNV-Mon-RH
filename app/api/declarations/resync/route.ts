import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"
import { syncDeclarationPeriode } from "@/lib/sync-declaration"

export async function POST() {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const periodes = await prisma.declarationPeriode.findMany({
    select: { mois: true, annee: true },
  })

  await Promise.all(periodes.map(p => syncDeclarationPeriode(p.mois, p.annee)))

  return NextResponse.json({ ok: true, count: periodes.length })
}
