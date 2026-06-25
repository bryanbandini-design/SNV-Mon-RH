import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { ContratClient } from "./ContratClient"

export default async function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  const [employe, parametres] = await Promise.all([
    prisma.employe.findUnique({ where: { id } }),
    prisma.parametre.findMany(),
  ])
  if (!employe) notFound()

  const pm: Record<string, string> = Object.fromEntries(parametres.map(r => [r.cle, r.valeur]))
  const entreprise = {
    nom:       pm.ENTREPRISE_NOM      || "Mon Entreprise",
    adresse:   pm.ENTREPRISE_ADRESSE  || "",
    rccm:      pm.ENTREPRISE_RCCM     || "",
    niu:       pm.ENTREPRISE_NIU      || "",
    tel:       pm.ENTREPRISE_TEL      || "",
    email:     pm.ENTREPRISE_EMAIL    || "",
    dirigeant: pm.ENTREPRISE_DIRIGEANT || "",
  }

  return (
    <ContratClient
      employe={{
        id:              employe.id,
        prenom:          employe.prenom,
        nom:             employe.nom,
        matricule:       employe.matricule,
        poste:           employe.poste,
        departement:     employe.departement,
        typeContrat:     employe.typeContrat,
        dateEmbauche:    employe.dateEmbauche.toISOString(),
        dateFinContrat:  employe.dateFinContrat?.toISOString() ?? null,
        salaireBase:     employe.salaireBase,
        adresse:         employe.adresse,
        nationalite:     employe.nationalite,
        numeroCni:       employe.numeroCni,
        periodeEssai:    employe.periodeEssai,
        dateDebutEssai:  employe.dateDebutEssai?.toISOString() ?? null,
        dateFinEssai:    employe.dateFinEssai?.toISOString() ?? null,
      }}
      entreprise={entreprise}
    />
  )
}
