import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Crée un accès employé lié à la fiche Employe
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any)?.role
  if (role !== "RH" && role !== "ADMIN") return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const { id } = await params
  const { email, password } = await req.json()

  const employe = await prisma.employe.findUnique({
    where: { id },
    include: { utilisateur: { select: { id: true } } },
  })
  if (!employe) return NextResponse.json({ message: "Employé introuvable" }, { status: 404 })
  if (employe.utilisateur) return NextResponse.json({ message: "Cet employé possède déjà un compte" }, { status: 409 })

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) return NextResponse.json({ message: "Cet email est déjà utilisé" }, { status: 409 })

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      name:      `${employe.prenom} ${employe.nom}`,
      role:      "EMPLOYE",
      employeId: employe.id,
    },
  })

  return NextResponse.json({ userId: user.id, email: user.email }, { status: 201 })
}

// Supprime le compte employé (sans supprimer la fiche)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any)?.role
  if (role !== "RH" && role !== "ADMIN") return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const { id } = await params
  const employe = await prisma.employe.findUnique({
    where: { id },
    include: { utilisateur: { select: { id: true } } },
  })
  if (!employe?.utilisateur) return NextResponse.json({ message: "Aucun compte à supprimer" }, { status: 404 })

  await prisma.user.delete({ where: { id: employe.utilisateur.id } })
  return NextResponse.json({ ok: true })
}
