import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/historique?module=EMPLOYES&action=CREATE&userId=xxx&dateFrom=2026-01-01&dateTo=2026-12-31&page=1&q=search
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const url = new URL(req.url)
  const module   = url.searchParams.get("module")
  const action   = url.searchParams.get("action")
  const userId   = url.searchParams.get("userId")
  const dateFrom = url.searchParams.get("dateFrom")
  const dateTo   = url.searchParams.get("dateTo")
  const q        = url.searchParams.get("q")
  const page     = parseInt(url.searchParams.get("page") ?? "1", 10)
  const limit    = 50

  const where: any = {}

  if (module)   where.module = module
  if (action)   where.action = action
  if (userId)   where.userId = userId
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) {
      const d = new Date(dateFrom); d.setHours(0, 0, 0, 0)
      where.createdAt.gte = d
    }
    if (dateTo) {
      const d = new Date(dateTo); d.setHours(23, 59, 59, 999)
      where.createdAt.lte = d
    }
  }
  if (q) {
    where.OR = [
      { description: { contains: q } },
      { userName:    { contains: q } },
    ]
  }

  const [total, logs] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  // Stats par module (indépendant des filtres)
  const byModule = await prisma.activityLog.groupBy({
    by: ["module"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  })

  // Utilisateurs actifs (pour le filtre)
  const users = await prisma.activityLog.groupBy({
    by: ["userId", "userName", "userRole"],
    _count: { id: true },
    where: { userId: { not: null } },
    orderBy: { _count: { id: "desc" } },
    take: 20,
  })

  return NextResponse.json({ total, logs, page, totalPages: Math.ceil(total / limit), byModule, users })
}
