import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const employes = await prisma.employe.findMany({
    orderBy: { nom: "asc" },
    include: { utilisateur: { select: { role: true } } },
  })
  const result = employes.map(({ utilisateur, ...e }) => ({
    ...e,
    userRole: utilisateur?.role ?? null,
  }))
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()

  const existing = await prisma.employe.findUnique({ where: { matricule: data.matricule } })
  if (existing) {
    return NextResponse.json({ message: "Ce matricule est déjà utilisé" }, { status: 400 })
  }

  const employe = await prisma.employe.create({
    data: {
      matricule: data.matricule,
      prenom: data.prenom,
      nom: data.nom,
      email: data.email || null,
      telephone: data.telephone || null,
      dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : null,
      lieuNaissance: data.lieuNaissance || null,
      adresse: data.adresse || null,
      nationalite: data.nationalite || null,
      numeroCni: data.numeroCni || null,
      poste: data.poste,
      departement: data.departement || null,
      typeContrat: data.typeContrat,
      dateEmbauche: new Date(data.dateEmbauche),
      dateFinContrat: data.dateFinContrat ? new Date(data.dateFinContrat) : null,
      periodeEssai: data.periodeEssai === "true",
      dateDebutEssai: data.dateDebutEssai ? new Date(data.dateDebutEssai) : null,
      dateFinEssai: data.dateFinEssai ? new Date(data.dateFinEssai) : null,
      salaireBase: parseFloat(data.salaireBase),
      notes: data.notes || null,
    },
  })

  await logActivity({
    session,
    action: "CREATE",
    module: "EMPLOYES",
    description: `Création de la fiche employé ${employe.prenom} ${employe.nom} (${employe.matricule})`,
    entityId: employe.id,
    entityType: "Employe",
    metadata: { poste: employe.poste, typeContrat: employe.typeContrat },
  })

  return NextResponse.json(employe, { status: 201 })
}
