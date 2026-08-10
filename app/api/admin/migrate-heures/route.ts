import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"
import { calculerHS } from "@/lib/utils"

// POST /api/admin/migrate-heures
// Recalcule heuresTravaillees pour tous les enregistrements existants :
// - Déduit 30 min de pause
// - Plafonne à 7h en semaine, 5h le week-end
// - Corrige les records où VALIDER_HS avait ajouté les HS à heuresTravaillees
export async function POST() {
  const { error } = await requireRole(["ADMIN"])
  if (error) return error

  const presences = await prisma.presence.findMany({
    where: { heureArrivee: { not: null }, heureDepart: { not: null } },
    select: {
      id: true, date: true,
      heureArrivee: true, heureDepart: true,
      heureDebutShiftRef: true, heureFinShiftRef: true,
      statutHeuresSup: true,
    },
  })

  let updated = 0
  const errors: string[] = []

  for (const p of presences) {
    try {
      const dow       = new Date(p.date).getUTCDay()
      const isWeekend = dow === 0 || dow === 6

      const hs = calculerHS({
        heureArrivee:       p.heureArrivee!,
        heureDepart:        p.heureDepart!,
        heureDebutShiftRef: p.heureDebutShiftRef,
        heureFinShiftRef:   p.heureFinShiftRef,
        isWeekend,
      })

      await prisma.presence.update({
        where: { id: p.id },
        data:  {
          heuresTravaillees: hs.heuresTravaillees,
          heuresSupBrutes:   hs.heuresSupBrutes,
          // On conserve le statut HS existant (VALIDEE/REJETEE/EN_ATTENTE)
          // sauf si le recalcul donne 0 HS (plus de dépassement de shift)
          statutHeuresSup: hs.heuresSupBrutes === 0 ? "N/A" : p.statutHeuresSup,
        },
      })
      updated++
    } catch (e) {
      errors.push(`${p.id}: ${e}`)
    }
  }

  return NextResponse.json({
    ok: true,
    total: presences.length,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  })
}
