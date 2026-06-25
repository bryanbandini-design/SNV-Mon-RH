import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { DEFAULT_PERMISSIONS } from "@/lib/permissions"
import type { PermKey } from "@/lib/permissions"

const VALID_ROLES = ["ADMIN", "RH", "RESPONSABLE", "EMPLOYE"]

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callerRole = (session.user as any)?.role
  if (callerRole !== "RH" && callerRole !== "ADMIN") {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 })
  }

  const { id } = await params
  const { email: rawId, password, role: reqRole, permissions: rawPerms } = await req.json()

  if (!rawId || !password) {
    return NextResponse.json({ message: "Identifiant et mot de passe requis" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 })
  }

  const role: string = VALID_ROLES.includes(reqRole) ? reqRole : "EMPLOYE"

  // Identifiant sans @ → on ajoute @local pour cohérence avec le login
  const identifiant = (rawId as string).trim()
  const email = identifiant.includes("@") ? identifiant : `${identifiant}@local`

  const employe = await prisma.employe.findUnique({
    where: { id },
    include: { utilisateur: { select: { id: true } } },
  })
  if (!employe) return NextResponse.json({ message: "Employé introuvable" }, { status: 404 })
  if (employe.utilisateur) return NextResponse.json({ message: "Cet employé possède déjà un compte" }, { status: 409 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ message: "Cet identifiant est déjà utilisé" }, { status: 409 })

  const permissions: PermKey[] = Array.isArray(rawPerms) ? rawPerms : (DEFAULT_PERMISSIONS[role] ?? [])
  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      name:         `${employe.prenom} ${employe.nom}`,
      role,
      permissions:  JSON.stringify(permissions),
      employeId:    employe.id,
    },
  })

  return NextResponse.json({ userId: user.id, email: user.email }, { status: 201 })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callerRole = (session.user as any)?.role
  if (callerRole !== "RH" && callerRole !== "ADMIN") {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 })
  }

  const { id } = await params
  const employe = await prisma.employe.findUnique({
    where: { id },
    include: { utilisateur: { select: { id: true } } },
  })
  if (!employe?.utilisateur) return NextResponse.json({ message: "Aucun compte à supprimer" }, { status: 404 })

  await prisma.user.delete({ where: { id: employe.utilisateur.id } })
  return NextResponse.json({ ok: true })
}
