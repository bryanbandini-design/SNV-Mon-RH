import { prisma } from "@/lib/prisma"
import { CAMEROUN } from "@/lib/cameroun-salaire"

export async function syncDeclarationPeriode(mois: number, annee: number) {
  const salaires = await prisma.historiqueSalaire.findMany({
    where: { mois, annee, statut: "PAYE" },
  })
  if (salaires.length === 0) return

  const totalBrutCNPS     = salaires.reduce((s, r) => s + Math.min(r.brutImposable, CAMEROUN.CNPS_PLAFOND_MENSUEL), 0)
  const totalCNPSSalarie  = salaires.reduce((s, r) => s + r.cnpsSalarie, 0)
  const totalCNPSPatronal = salaires.reduce((s, r) => s + r.cnpsPatronal, 0)
  const totalCNPS         = totalCNPSSalarie + totalCNPSPatronal
  const totalIRPP         = salaires.reduce((s, r) => s + r.irpp, 0)
  const totalCAC          = salaires.reduce((s, r) => s + r.cac, 0)
  const totalRAV          = salaires.reduce((s, r) => s + r.rav, 0)
  const totalImpots       = totalIRPP + totalCAC + totalRAV
  const totalAVerser      = totalCNPS + totalImpots
  const nbSalaries        = salaires.length

  await prisma.declarationPeriode.upsert({
    where:  { mois_annee: { mois, annee } },
    create: { mois, annee, totalBrutCNPS, totalCNPSSalarie, totalCNPSPatronal, totalCNPS, totalIRPP, totalCAC, totalRAV, totalImpots, totalAVerser, nbSalaries },
    update: { totalBrutCNPS, totalCNPSSalarie, totalCNPSPatronal, totalCNPS, totalIRPP, totalCAC, totalRAV, totalImpots, totalAVerser, nbSalaries },
  })
}
