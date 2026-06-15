import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any)?.role ?? "RH"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string

  // RESPONSABLE ne voit que ses propres dossiers ; RH et ADMIN voient tout
  const where = role === "RESPONSABLE" ? { initiePar: userId } : {}

  const dossiers = await prisma.dossierDisciplinaire.findMany({
    where,
    include: {
      employe: { select: { prenom: true, nom: true, matricule: true } },
      initiateur: { select: { name: true } },
      documents: true,
      notifications: { where: { lu: false }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(dossiers)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string

  const data = await req.json()

  const dossier = await prisma.dossierDisciplinaire.create({
    data: {
      employeId:         data.employeId,
      type:              data.type,
      date:              new Date(data.date),
      motif:             data.motif,
      description:       data.description,
      sanctions:         data.sanctions  || null,
      suites:            data.suites     || null,
      statut:            "INITIE",
      initiePar:         userId,
      delaiReponseJours: data.delaiReponseJours ? Number(data.delaiReponseJours) : 5,
      categoriesFaits:   data.categoriesFaits   || null,
      niveauGravite:     data.niveauGravite      || null,
      temoins:           data.temoins            || null,
    },
  })

  // Log d'audit initial
  await prisma.auditLog.create({
    data: {
      dossierId: dossier.id,
      auteurId:  userId,
      auteurNom: session.user?.name ?? "Inconnu",
      type:      "CREATION",
      description: `Procédure initiée par ${session.user?.name} — Type : ${data.type.replace(/_/g, " ")}${data.niveauGravite ? ` — Gravité : ${data.niveauGravite}` : ""}`,
    },
  })

  // Notifier tous les RH et ADMIN
  const rhUsers = await prisma.user.findMany({ where: { role: { in: ["RH", "ADMIN"] } } })
  const emp     = await prisma.employe.findUnique({
    where: { id: data.employeId },
    select: { prenom: true, nom: true },
  })

  if (rhUsers.length && emp) {
    await prisma.notification.createMany({
      data: rhUsers.map(u => ({
        userId:    u.id,
        type:      "DEMANDE_INITIE",
        titre:     "Nouvelle demande disciplinaire",
        message:   `${session.user?.name} a initié une procédure « ${data.type.replace(/_/g, " ")} » pour ${emp.prenom} ${emp.nom}.`,
        dossierId: dossier.id,
      })),
    })
  }

  return NextResponse.json(dossier, { status: 201 })
}
