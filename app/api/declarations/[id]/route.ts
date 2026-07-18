import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  const decl = await prisma.declarationPeriode.findUnique({ where: { id } })
  if (!decl) return NextResponse.json({ message: "Non trouvé" }, { status: 404 })

  const salaires = await prisma.historiqueSalaire.findMany({
    where:   { mois: decl.mois, annee: decl.annee, statut: "PAYE" },
    include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true } } },
    orderBy: { employe: { nom: "asc" } },
  })

  return NextResponse.json({ ...decl, salaires })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  const body   = await req.json()
  const now    = new Date()

  let data: Record<string, unknown> = {}
  switch (body.action) {
    case "TRANSMETTRE":
      data = { statut: "TRANSMISE", dateTransmission: now }
      break
    case "PAYER_CNPS":
      data = { datePaiementCNPS: now }
      break
    case "PAYER_IMPOTS":
      data = { datePaiementImpots: now }
      break
    case "SOLDER":
      data = { statut: "SOLDEE", datePaiementCNPS: now, datePaiementImpots: now }
      break
    default:
      if (body.notes !== undefined) data.notes = body.notes
      if (body.statut)              data.statut = body.statut
  }

  const updated = await prisma.declarationPeriode.update({ where: { id }, data })
  return NextResponse.json(updated)
}
