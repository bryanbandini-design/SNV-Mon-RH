import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const data   = await req.json()

  const device = await prisma.zktecoDevice.update({
    where: { id },
    data: {
      nom:   data.nom  ?? undefined,
      lieu:  data.lieu ?? null,
      actif: data.actif ?? undefined,
    },
  })

  return NextResponse.json(device)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  await prisma.zktecoDevice.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
