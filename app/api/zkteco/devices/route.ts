import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const devices = await prisma.zktecoDevice.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { pointages: true } },
    },
  })

  return NextResponse.json(devices)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const data = await req.json()

  const device = await prisma.zktecoDevice.upsert({
    where:  { serialNumber: data.serialNumber },
    update: { nom: data.nom || undefined, lieu: data.lieu || null, actif: data.actif ?? true },
    create: {
      serialNumber: data.serialNumber,
      nom:          data.nom  || `Terminal ${data.serialNumber}`,
      lieu:         data.lieu || null,
    },
  })

  return NextResponse.json(device, { status: 201 })
}
