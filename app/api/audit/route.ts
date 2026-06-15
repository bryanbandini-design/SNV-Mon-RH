import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/audit?dossierId=xxx
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dossierId = searchParams.get("dossierId")
  if (!dossierId) return NextResponse.json([])

  const logs = await prisma.auditLog.findMany({
    where: { dossierId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(logs)
}
