import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { calculerSalaire, CAMEROUN } from "@/lib/cameroun-salaire"
// montantHS est déjà stocké en base, on le passe directement
import { MOIS } from "@/lib/utils"
import PrintClient from "./PrintClient"

export default async function BulletinPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params

  const [salaire, parametres] = await Promise.all([
    prisma.historiqueSalaire.findUnique({
      where: { id },
      include: { employe: { select: { prenom: true, nom: true, matricule: true, poste: true, departement: true, dateEmbauche: true, typeContrat: true } } },
    }),
    prisma.parametre.findMany(),
  ])

  if (!salaire) notFound()

  // Premier et dernier bulletin payé pour cet employé (pour l'attestation)
  const [firstPaid, lastPaid] = await Promise.all([
    prisma.historiqueSalaire.findFirst({
      where:   { employeId: salaire.employeId, statut: "PAYE" },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
      select:  { mois: true, annee: true },
    }),
    prisma.historiqueSalaire.findFirst({
      where:   { employeId: salaire.employeId, statut: "PAYE" },
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
      select:  { mois: true, annee: true },
    }),
  ])

  const params_map: Record<string, string> = Object.fromEntries(parametres.map(r => [r.cle, r.valeur]))
  const entreprise = {
    nom:       params_map.ENTREPRISE_NOM       || "Mon Entreprise",
    adresse:   params_map.ENTREPRISE_ADRESSE   || "",
    rccm:      params_map.ENTREPRISE_RCCM      || "",
    niu:       params_map.ENTREPRISE_NIU        || "",
    tel:       params_map.ENTREPRISE_TEL        || "",
    email:     params_map.ENTREPRISE_EMAIL      || "",
    dirigeant: params_map.ENTREPRISE_DIRIGEANT  || "",
  }

  const montantHS = salaire.montantHS ?? 0
  const avanceDeduite = salaire.avanceDeduite ?? 0
  const calc     = calculerSalaire(salaire.salaireBase, salaire.primes, salaire.retenues + avanceDeduite, montantHS)
  const moisLib  = MOIS[salaire.mois - 1] ?? `Mois ${salaire.mois}`
  const isPaye   = salaire.statut === "PAYE"
  const baseCNPS = Math.min(calc.brutImposable, CAMEROUN.CNPS_PLAFOND_MENSUEL)

  return (
    <PrintClient
      moisLib={moisLib}
      annee={salaire.annee}
      isPaye={isPaye}
      datePaiement={salaire.datePaiement ? new Date(salaire.datePaiement).toLocaleDateString("fr-FR") : null}
      notes={salaire.notes}
      employe={{
        prenom:       salaire.employe.prenom,
        nom:          salaire.employe.nom,
        matricule:    salaire.employe.matricule,
        poste:        salaire.employe.poste,
        departement:  salaire.employe.departement ?? undefined,
        dateEmbauche: new Date(salaire.employe.dateEmbauche).toLocaleDateString("fr-FR"),
        typeContrat:  salaire.employe.typeContrat,
      }}
      entreprise={entreprise}
      salaireBase={salaire.salaireBase}
      primes={salaire.primes}
      retenues={salaire.retenues}
      heuresSupplementaires={salaire.heuresSupplementaires ?? 0}
      montantHS={montantHS}
      avanceDeduite={avanceDeduite}
      calc={calc}
      baseCNPS={baseCNPS}
      genereLe={new Date().toLocaleDateString("fr-FR")}
      firstPaid={firstPaid ?? undefined}
      lastPaid={lastPaid ?? undefined}
    />
  )
}
