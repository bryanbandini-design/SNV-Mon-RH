import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const data   = await req.json()

  // Inscription d'un employé
  if (data.action === "INSCRIRE") {
    const existing = await prisma.participationFormation.findUnique({
      where: { formationId_employeId: { formationId: id, employeId: data.employeId } },
    })
    if (existing) return NextResponse.json({ message: "Déjà inscrit" }, { status: 400 })
    const p = await prisma.participationFormation.create({
      data: { formationId: id, employeId: data.employeId, statut: "INSCRIT" },
      include: { employe: { select: { prenom: true, nom: true, poste: true } } },
    })
    return NextResponse.json(p, { status: 201 })
  }

  // Mise à jour statut participation
  if (data.action === "MAJ_PARTICIPATION") {
    const p = await prisma.participationFormation.update({
      where: { formationId_employeId: { formationId: id, employeId: data.employeId } },
      data: {
        ...(data.statut     !== undefined && { statut:     data.statut }),
        ...(data.note       !== undefined && { note:       data.note }),
        ...(data.certificat !== undefined && { certificat: data.certificat }),
      },
    })
    return NextResponse.json(p)
  }

  // Désinscrire
  if (data.action === "DESINSCRIRE") {
    await prisma.participationFormation.delete({
      where: { formationId_employeId: { formationId: id, employeId: data.employeId } },
    })
    return NextResponse.json({ ok: true })
  }

  // Mise à jour formation
  const formation = await prisma.formation.update({
    where: { id },
    data: {
      ...(data.titre     !== undefined && { titre:     data.titre }),
      ...(data.statut    !== undefined && { statut:    data.statut }),
      ...(data.type      !== undefined && { type:      data.type }),
      ...(data.organisme !== undefined && { organisme: data.organisme || null }),
      ...(data.lieu      !== undefined && { lieu:      data.lieu      || null }),
      ...(data.dateDebut !== undefined && { dateDebut: data.dateDebut ? new Date(data.dateDebut) : null }),
      ...(data.dateFin   !== undefined && { dateFin:   data.dateFin   ? new Date(data.dateFin)   : null }),
      ...(data.cout      !== undefined && { cout:      data.cout      ? parseFloat(data.cout)      : null }),
      ...(data.dureeHeures !== undefined && { dureeHeures: data.dureeHeures ? parseFloat(data.dureeHeures) : null }),
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "UPDATE", module: "FORMATIONS", description: `Formation mise à jour : ${formation.titre}`, entityId: formation.id, entityType: "Formation" })
  return NextResponse.json(formation)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.formation.delete({ where: { id } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "DELETE", module: "FORMATIONS", description: "Formation supprimée", entityId: id, entityType: "Formation" })
  return NextResponse.json({ ok: true })
}
