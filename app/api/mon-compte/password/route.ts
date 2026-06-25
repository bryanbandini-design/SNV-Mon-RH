import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: Request) {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "Champs requis" }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 })

  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) return NextResponse.json({ message: "Mot de passe actuel incorrect" }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })

  return NextResponse.json({ ok: true })
}
