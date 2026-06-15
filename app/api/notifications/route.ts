import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string
  if (!userId) return NextResponse.json([])

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(notifications)
}

// PATCH /api/notifications  → { ids: string[] } pour marquer comme lus
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string
  const data   = await req.json()

  if (data.all) {
    await prisma.notification.updateMany({ where: { userId, lu: false }, data: { lu: true } })
  } else if (Array.isArray(data.ids)) {
    await prisma.notification.updateMany({
      where: { id: { in: data.ids }, userId },
      data:  { lu: true },
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/notifications → { all: true } ou { ids: string[] }
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string
  const data   = await req.json()

  if (data.all) {
    await prisma.notification.deleteMany({ where: { userId } })
  } else if (Array.isArray(data.ids)) {
    await prisma.notification.deleteMany({ where: { id: { in: data.ids }, userId } })
  }

  return NextResponse.json({ ok: true })
}
