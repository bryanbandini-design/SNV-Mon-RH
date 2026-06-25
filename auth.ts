import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { authConfig } from "@/auth.config"
import { parsePermissions, DEFAULT_PERMISSIONS } from "@/lib/permissions"
import type { PermKey } from "@/lib/permissions"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.email as string | undefined)?.trim()
        const password   = credentials?.password as string | undefined

        if (!identifier || !password) return null

        // Identifiant sans @ → nom d'utilisateur → cherche username@local
        const email = identifier.includes("@") ? identifier : `${identifier}@local`

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        // Log connexion réussie
        await logActivity({
          userId:   user.id,
          userName: user.name,
          userRole: user.role,
          action:   "LOGIN",
          module:   "AUTH",
          description: `Connexion de ${user.name} (${user.email})`,
          metadata: { email: user.email, role: user.role },
        })

        // Si permissions vide, utiliser les valeurs par défaut du rôle
        const stored = parsePermissions(user.permissions)
        const permissions: PermKey[] = stored.length > 0
          ? stored
          : (DEFAULT_PERMISSIONS[user.role] ?? [])

        return { id: user.id, email: user.email, name: user.name, role: user.role, employeId: user.employeId ?? null, permissions }
      },
    }),
  ],
})
