import type { NextAuthConfig } from "next-auth"

// Edge-compatible subset of auth config — no database imports
export const authConfig: NextAuthConfig = {
  secret:    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],  // credentials provider defined in auth.ts (Node.js only)
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    jwt({ token, user }) {
      if (user) {
        token.id          = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role        = (user as any).role        ?? "RH"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.employeId   = (user as any).employeId   ?? null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.permissions = (user as any).permissions ?? []
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any
        u.id          = token.id          as string
        u.role        = token.role        as string
        u.employeId   = token.employeId   as string | null
        u.permissions = token.permissions as string[]
      }
      return session
    },
  },
}
