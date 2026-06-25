import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeId = searchParams.get("employeId")
  const type      = searchParams.get("type") ?? "TRAVAIL" // TRAVAIL | SALAIRE

  if (!employeId) return NextResponse.json({ message: "employeId requis" }, { status: 400 })

  const employe = await prisma.employe.findUnique({
    where: { id: employeId },
    include: {
      historiqueSalaires: { orderBy: [{ annee: "desc" }, { mois: "desc" }], take: 1 },
    },
  })
  if (!employe) return NextResponse.json({ message: "Employé introuvable" }, { status: 404 })

  const config = await prisma.parametre.findMany({
    where: { cle: { in: ["ENTREPRISE_NOM", "ENTREPRISE_ADRESSE", "ENTREPRISE_RCCM", "ENTREPRISE_NIU", "ENTREPRISE_TEL", "ENTREPRISE_EMAIL", "ENTREPRISE_DIRIGEANT"] } },
  })
  const cfg = Object.fromEntries(config.map(p => [p.cle, p.valeur]))
  const entreprise = {
    nom:       cfg.ENTREPRISE_NOM       ?? "Mon Entreprise",
    adresse:   cfg.ENTREPRISE_ADRESSE   ?? "",
    rccm:      cfg.ENTREPRISE_RCCM      ?? "",
    niu:       cfg.ENTREPRISE_NIU       ?? "",
    tel:       cfg.ENTREPRISE_TEL       ?? "",
    email:     cfg.ENTREPRISE_EMAIL     ?? "",
    dirigeant: cfg.ENTREPRISE_DIRIGEANT ?? "",
  }

  const now   = new Date()
  const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
  const anciennete = (() => {
    const diff = Math.floor((now.getTime() - new Date(employe.dateEmbauche).getTime()) / (1000 * 60 * 60 * 24 * 30))
    return diff >= 12 ? `${Math.floor(diff / 12)} an(s)` : `${diff} mois`
  })()

  const derSalaire = employe.historiqueSalaires[0]
  const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

  return NextResponse.json({
    type,
    employe: {
      prenom:    employe.prenom,
      nom:       employe.nom,
      matricule: employe.matricule,
      poste:     employe.poste,
      departement: employe.departement,
      typeContrat: employe.typeContrat,
      dateEmbauche: new Date(employe.dateEmbauche).toLocaleDateString("fr-FR"),
      salaireBase: employe.salaireBase,
      anciennete,
      derSalaire: derSalaire ? {
        mois:      MOIS[derSalaire.mois - 1],
        annee:     derSalaire.annee,
        netAPayer: derSalaire.netAPayer,
      } : null,
    },
    entreprise,
    dateEdition: dateStr,
  })
}
