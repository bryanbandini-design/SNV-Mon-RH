import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH"])
  if (error) return error

  const { id } = await params
  await prisma.annonce.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
