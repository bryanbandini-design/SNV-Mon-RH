import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/pointage/admin?date=2026-06-23&page=1
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const dateParam = url.searchParams.get("date")
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const limit = 50

    let dateFilter: { gte: Date; lt: Date } | undefined
    if (dateParam) {
      // Use full-day range to avoid timezone offset issues
      const d = new Date(dateParam + "T00:00:00")
      const next = new Date(dateParam + "T00:00:00")
      next.setDate(next.getDate() + 1)
      dateFilter = { gte: d, lt: next }
    }

    const [total, pointages] = await Promise.all([
      prisma.pointage.count({ where: dateFilter ? { dateEntree: dateFilter } : {} }),
      prisma.pointage.findMany({
        where: dateFilter ? { dateEntree: dateFilter } : {},
        include: {
          employe: { select: { prenom: true, nom: true, matricule: true, poste: true, photoUrl: true } },
          atelier: { select: { nom: true, couleur: true } },
        },
        orderBy: { dateEntree: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({ total, pointages, page, totalPages: Math.ceil(total / limit) }, {
      headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=40" },
    })
  } catch (err) {
    console.error("[pointage/admin GET]", err)
    return NextResponse.json({ error: String(err), total: 0, pointages: [], page: 1, totalPages: 0 }, { status: 500 })
  }
}

// PATCH /api/pointage/admin — correction manuelle RH
export async function PATCH(req: Request) {
  try {
    const { id, statut, noteRH, atelierId, dateSortie } = await req.json()
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

    const updated = await prisma.pointage.update({
      where: { id },
      data: {
        ...(statut && { statut }),
        ...(noteRH !== undefined && { noteRH }),
        ...(atelierId !== undefined && { atelierId }),
        ...(dateSortie !== undefined && { dateSortie: dateSortie ? new Date(dateSortie) : null }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error("[pointage/admin PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
