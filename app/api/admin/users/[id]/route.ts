import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

async function requireAdmin() {
  const session = await auth()
  if (!session) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any)?.role !== "ADMIN") return null
  return session
}

// ── PATCH — met à jour un utilisateur ────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { email: rawId, name, role, password, permissions: rawPerms } = body

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 })

  // Conversion identifiant → email interne si besoin
  const email = rawId
    ? ((rawId as string).includes("@") ? (rawId as string) : `${rawId}@local`)
    : undefined

  if (email && email !== existing.email) {
    const conflict = await prisma.user.findUnique({ where: { email } })
    if (conflict) return NextResponse.json({ message: "Cet identifiant est déjà utilisé" }, { status: 409 })
  }

  if (role) {
    const VALID_ROLES = ["ADMIN", "RH", "RESPONSABLE", "EMPLOYE"]
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ message: "Rôle invalide" }, { status: 400 })
    }
  }

  if (password && password.length < 8) {
    return NextResponse.json({ message: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (email)       data.email        = email
  if (name)        data.name         = name
  if (role)        data.role         = role
  if (password)    data.passwordHash = await bcrypt.hash(password, 10)
  if (rawPerms !== undefined) data.permissions = JSON.stringify(Array.isArray(rawPerms) ? rawPerms : [])

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, permissions: true, createdAt: true, employeId: true },
  })

  return NextResponse.json(updated)
}

// ── DELETE — supprime un utilisateur ──────────────────────────────────────
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selfId = (session.user as any)?.id
  if (id === selfId) {
    return NextResponse.json({ message: "Impossible de supprimer votre propre compte" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 })

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
