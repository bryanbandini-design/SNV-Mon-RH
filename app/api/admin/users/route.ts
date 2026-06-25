import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { DEFAULT_PERMISSIONS } from "@/lib/permissions"
import type { PermKey } from "@/lib/permissions"

async function requireAdmin() {
  const session = await auth()
  if (!session) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any)?.role !== "ADMIN") return null
  return session
}

// ── GET — liste tous les utilisateurs ─────────────────────────────────────
export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id:          true,
      email:       true,
      name:        true,
      role:        true,
      permissions: true,
      employeId:   true,
      createdAt:   true,
      employe: {
        select: { prenom: true, nom: true, poste: true, departement: true, statut: true },
      },
    },
  })

  return NextResponse.json(users)
}

// ── POST — crée un utilisateur ─────────────────────────────────────────────
export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ message: "Accès refusé" }, { status: 403 })

  const { email: rawId, password, name, role, employeId, permissions: rawPerms } = await req.json()

  if (!rawId || !password || !role) {
    return NextResponse.json({ message: "Champs requis : identifiant, password, role" }, { status: 400 })
  }

  // Si l'identifiant ne contient pas @, c'est un nom d'utilisateur → stocké comme username@local
  const email = (rawId as string).includes("@") ? (rawId as string) : `${rawId}@local`

  const VALID_ROLES = ["ADMIN", "RH", "RESPONSABLE", "EMPLOYE"]
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ message: "Rôle invalide" }, { status: 400 })
  }

  // EMPLOYE doit obligatoirement être lié à un employé
  if (role === "EMPLOYE" && !employeId) {
    return NextResponse.json({ message: "Un employé doit être sélectionné pour le rôle Employé" }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ message: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ message: "Cet identifiant est déjà utilisé" }, { status: 409 })

  const permissions: PermKey[] = Array.isArray(rawPerms) ? rawPerms : (DEFAULT_PERMISSIONS[role] ?? [])
  const permissionsJson = JSON.stringify(permissions)

  // Si un employeId est fourni (quel que soit le rôle), on vérifie et on lie
  if (employeId) {
    const employe = await prisma.employe.findUnique({
      where: { id: employeId },
      include: { utilisateur: { select: { id: true } } },
    })
    if (!employe) return NextResponse.json({ message: "Employé introuvable" }, { status: 404 })
    if (employe.utilisateur) return NextResponse.json({ message: "Cet employé possède déjà un compte" }, { status: 409 })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: name || `${employe.prenom} ${employe.nom}`,
        role,
        permissions: permissionsJson,
        employeId,
      },
      select: { id: true, email: true, name: true, role: true, permissions: true, createdAt: true },
    })
    return NextResponse.json(user, { status: 201 })
  }

  if (!name) return NextResponse.json({ message: "Le nom est requis" }, { status: 400 })

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, passwordHash: hash, name, role, permissions: permissionsJson },
    select: { id: true, email: true, name: true, role: true, permissions: true, createdAt: true },
  })

  return NextResponse.json(user, { status: 201 })
}
