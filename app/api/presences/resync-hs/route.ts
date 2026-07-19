import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"

// Retroactivement applique le cap 8h sur les saisies manuelles existantes
// qui ont heuresTravaillees > 8 sans avoir été traitées par le système HS
export async function POST() {
  const { error } = await requireRole(["ADMIN"])
  if (error) return error

  const candidats = await prisma.presence.findMany({
    where: {
      saisieManuelle: true,
      statutHeuresSup: "N/A",
      heuresTravaillees: { gt: 8 },
    },
    select: { id: true, heuresTravaillees: true },
  })

  if (candidats.length === 0) {
    return NextResponse.json({ count: 0, message: "Aucune saisie manuelle à recalibrer" })
  }

  await Promise.all(
    candidats.map(p =>
      prisma.presence.update({
        where: { id: p.id },
        data: {
          heuresSupBrutes:  (p.heuresTravaillees ?? 0) - 8,
          heuresTravaillees: 8,
          statutHeuresSup:  "EN_ATTENTE",
        },
      })
    )
  )

  return NextResponse.json({
    count: candidats.length,
    message: `${candidats.length} saisie(s) manuelle(s) recalibrée(s) — heures sup en attente de validation`,
  })
}
