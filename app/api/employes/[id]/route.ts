import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  const { id } = await params
  const employe = await prisma.employe.findUnique({ where: { id } })
  if (!employe) return NextResponse.json({ message: "Introuvable" }, { status: 404 })
  return NextResponse.json(employe)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
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
    },
  })
  return NextResponse.json(employe)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  const { id } = await params
  await prisma.employe.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
