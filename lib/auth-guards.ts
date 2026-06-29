import { auth } from "@/auth"
import { NextResponse } from "next/server"

type Role = "ADMIN" | "RH" | "RESPONSABLE" | "EMPLOYE"

export async function requireRole(allowed: Role[]) {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ message: "Non autorisé" }, { status: 401 }), session: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any)?.role as Role | undefined
  if (!role || !allowed.includes(role)) {
    return { error: NextResponse.json({ message: "Accès refusé" }, { status: 403 }), session: null }
  }
  return { error: null, session }
}
