import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role, employeId: user.employeId ?? null }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role      = (user as any).role      ?? "RH"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.employeId = (user as any).employeId ?? null
      }
      // Re-fetch role/employeId from DB if missing from token (stale session)
      if (token.id && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, employeId: true },
        })
        if (dbUser) {
          token.role      = dbUser.role
          token.employeId = dbUser.employeId ?? null
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any
        u.id        = token.id        as string
        u.role      = token.role      as string
        u.employeId = token.employeId as string | null
      }
      return session
    },
  },
})
