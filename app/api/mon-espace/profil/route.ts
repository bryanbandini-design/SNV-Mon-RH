import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const employe = await prisma.employe.findUnique({
    where: { id: employeId },
    select: {
      id: true, prenom: true, nom: true, email: true, telephone: true,
      poste: true, departement: true, typeContrat: true, dateEmbauche: true,
      salaireBase: true, statut: true, matricule: true, nationalite: true,
      adresse: true, photoUrl: true,
    },
  })

  if (!employe) return NextResponse.json({ message: "Employé introuvable" }, { status: 404 })
  return NextResponse.json({ employe }, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" },
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session.user as any)?.employeId as string | null
  if (!employeId) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const body = await req.json()
  const { telephone, adresse, email, contactUrgenceNom, contactUrgenceTel } = body

  const employe = await prisma.employe.update({
    where: { id: employeId },
    data: {
      ...(telephone         !== undefined && { telephone:          telephone         || null }),
      ...(adresse           !== undefined && { adresse:            adresse           || null }),
      ...(email             !== undefined && { email:              email             || null }),
      ...(contactUrgenceNom !== undefined && { contactUrgenceNom:  contactUrgenceNom || null }),
      ...(contactUrgenceTel !== undefined && { contactUrgenceTel:  contactUrgenceTel || null }),
    },
    select: { id: true, telephone: true, adresse: true, email: true, contactUrgenceNom: true, contactUrgenceTel: true },
  })

  return NextResponse.json({ employe })
}
