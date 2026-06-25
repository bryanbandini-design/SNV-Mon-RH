import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Aucun profil employé lié" }, { status: 403 })

  const [conges, employe] = await Promise.all([
    prisma.conge.findMany({ where: { employeId }, orderBy: { createdAt: "desc" } }),
    prisma.employe.findUnique({ where: { id: employeId }, select: { soldeCongesAnnuels: true } }),
  ])

  const currentYear = new Date().getFullYear()
  const joursAnnuelsPris = conges
    .filter(c => c.type === "ANNUEL" && c.statut === "APPROUVE" && new Date(c.dateDebut).getFullYear() === currentYear)
    .reduce((s, c) => s + c.nbJours, 0)

  const soldeAnnuel = employe?.soldeCongesAnnuels ?? 30

  return NextResponse.json({
    conges,
    solde: {
      annuel:  soldeAnnuel,
      pris:    joursAnnuelsPris,
      restant: soldeAnnuel - joursAnnuelsPris,
    },
  }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Aucun profil employé lié" }, { status: 403 })

  const data = await req.json()
  const dateDebut = new Date(data.dateDebut)
  const dateFin   = new Date(data.dateFin)
  const nbJours   = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / 86400000) + 1

  const conge = await prisma.conge.create({
    data: {
      employeId,
      type:     data.type,
      dateDebut,
      dateFin,
      nbJours,
      motif:  data.motif || null,
      statut: "EN_ATTENTE",
    },
  })

  // Notifier RH + ADMIN
  const employe = await prisma.employe.findUnique({ where: { id: employeId }, select: { prenom: true, nom: true } })
  const rhs = await prisma.user.findMany({ where: { role: { in: ["RH", "ADMIN"] } } })
  if (rhs.length && employe) {
    await prisma.notification.createMany({
      data: rhs.map(u => ({
        userId:  u.id,
        type:    "DEMANDE_INITIE",
        titre:   "Demande de congé",
        message: `${employe.prenom} ${employe.nom} a soumis une demande de congé (${data.type}) du ${dateDebut.toLocaleDateString("fr-FR")} au ${dateFin.toLocaleDateString("fr-FR")}.`,
      })),
    })
  }

  return NextResponse.json(conge, { status: 201 })
}
