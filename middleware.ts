import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)

const PUBLIC_PATHS = ["/login", "/pointer", "/api/auth", "/api/pointage/entree", "/api/pointage/confirmer", "/api/pointage/face", "/api/pointage/sortie", "/iclock/", "/api/public/"]
// /api/public/ couvre déjà /api/public/offres et /api/public/candidatures

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const session = await auth()
  if (!session) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
