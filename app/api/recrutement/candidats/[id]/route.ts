import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { requireRole } from "@/lib/auth-guards"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  const data   = await req.json()

  const candidat = await prisma.candidat.update({
    where: { id },
    data: {
      ...(data.statut      !== undefined && { statut:      data.statut }),
      ...(data.noteGlobale !== undefined && { noteGlobale: data.noteGlobale }),
      ...(data.commentaire !== undefined && { commentaire: data.commentaire || null }),
      ...(data.prenom      !== undefined && { prenom:      data.prenom }),
      ...(data.nom         !== undefined && { nom:         data.nom }),
      ...(data.email       !== undefined && { email:       data.email || null }),
      ...(data.telephone   !== undefined && { telephone:   data.telephone || null }),
      ...(data.source      !== undefined && { source:      data.source || null }),
    },
    include: { offre: { select: { titre: true } } },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "UPDATE", module: "RECRUTEMENT", description: `Candidat mis à jour → ${candidat.statut}`, entityId: candidat.id, entityType: "Candidat" })
  return NextResponse.json(candidat)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  await prisma.candidat.delete({ where: { id } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await logActivity({ session: session as any, action: "DELETE", module: "RECRUTEMENT", description: "Candidat supprimé", entityId: id, entityType: "Candidat" })
  return NextResponse.json({ ok: true })
}
