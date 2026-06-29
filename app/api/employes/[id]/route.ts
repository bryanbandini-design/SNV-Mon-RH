import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireRole } from "@/lib/auth-guards"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH", "RESPONSABLE"])
  if (error) return error
  const { id } = await params
  const employe = await prisma.employe.findUnique({ where: { id } })
  if (!employe) return NextResponse.json({ message: "Introuvable" }, { status: 404 })
  return NextResponse.json(employe)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error
  const { id } = await params
  const data = await req.json()

  const employe = await prisma.employe.update({
    where: { id },
    data: {
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
      periodeEssai: data.periodeEssai === "true" || data.periodeEssai === true,
      dateDebutEssai: data.dateDebutEssai ? new Date(data.dateDebutEssai) : null,
      dateFinEssai: data.dateFinEssai ? new Date(data.dateFinEssai) : null,
      salaireBase: parseFloat(data.salaireBase),
      statut: data.statut,
      notes: data.notes || null,
      managerId: data.managerId || null,
      contactUrgenceNom: data.contactUrgenceNom || null,
      contactUrgenceTel: data.contactUrgenceTel || null,
    },
  })

  await logActivity({
    session,
    action: "UPDATE",
    module: "EMPLOYES",
    description: `Modification de la fiche de ${employe.prenom} ${employe.nom} — statut : ${employe.statut}`,
    entityId: employe.id,
    entityType: "Employe",
    metadata: { poste: employe.poste, statut: employe.statut },
  })

  return NextResponse.json(employe)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN"])
  if (error) return error
  const { id } = await params

  const employe = await prisma.employe.findUnique({ where: { id }, select: { prenom: true, nom: true, matricule: true } })
  await prisma.employe.delete({ where: { id } })

  await logActivity({
    session,
    action: "DELETE",
    module: "EMPLOYES",
    description: `Suppression de l'employé ${employe?.prenom ?? ""} ${employe?.nom ?? ""} (${employe?.matricule ?? id})`,
    entityId: id,
    entityType: "Employe",
  })

  return NextResponse.json({ ok: true })
}
