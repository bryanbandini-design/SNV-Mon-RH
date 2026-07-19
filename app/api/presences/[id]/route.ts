import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes } from "@/lib/utils"
import { creerRetenueProvisoire, calculerRetenueRetard } from "@/lib/retenues"
import { requireRole } from "@/lib/auth-guards"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN", "RH", "RESPONSABLE"])
  if (error) return error

  const { id } = await params
  const data = await req.json()

  // ── Validation admin d'une saisie manuelle ────────────────────────────────
  if (data.action === "VALIDER" || data.action === "REJETER") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session!.user as any)?.role
    if (!["ADMIN", "RH", "RESPONSABLE"].includes(role)) {
      return NextResponse.json({ message: "Réservé au responsable ou à l'administrateur" }, { status: 403 })
    }

    const existing = await prisma.presence.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: "Non trouvé" }, { status: 404 })

    const updateData: Record<string, unknown> = {
      statutValidation: data.action === "VALIDER" ? "VALIDEE" : "REJETEE",
    }

    if (data.action === "VALIDER" && existing.heureArrivee && existing.heureDepart && existing.heuresTravaillees === null) {
      const debut = heureEnMinutes(existing.heureArrivee)
      const fin   = heureEnMinutes(existing.heureDepart)
      updateData.heuresTravaillees = Math.max(0, fin - debut) / 60
    }

    const presence = await prisma.presence.update({
      where: { id },
      data:  updateData,
      include: {
        employe: { select: { prenom: true, nom: true, matricule: true, poste: true, salaireBase: true } },
        retenueAbsence: true,
      },
    })

    if (data.action === "VALIDER" && !presence.retenueAbsence) {
      if (existing.statut === "ABSENT") {
        await creerRetenueProvisoire({
          employeId: existing.employeId,
          presenceId: id,
          type: "ABSENCE",
          date: existing.date,
          montant: 5_000,
          description: "Absence non justifiée",
        })
      } else if (existing.minutesRetard > 0) {
        const montant = calculerRetenueRetard(existing.minutesRetard, presence.employe.salaireBase)
        if (montant > 0) {
          await creerRetenueProvisoire({
            employeId: existing.employeId,
            presenceId: id,
            type: "RETARD",
            date: existing.date,
            montant,
            description: `${existing.minutesRetard} min de retard`,
          })
        }
      }
    }

    return NextResponse.json(presence)
  }

  // ── Validation des heures supplémentaires (ADMIN uniquement) ──────────────
  if (data.action === "VALIDER_HS" || data.action === "REJETER_HS") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session!.user as any)?.role
    if (role !== "ADMIN") {
      return NextResponse.json({ message: "Réservé à l'administrateur" }, { status: 403 })
    }

    const existing = await prisma.presence.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: "Non trouvé" }, { status: 404 })

    if (data.action === "VALIDER_HS") {
      // Ajouter les HS brutes aux heures comptabilisées
      const presence = await prisma.presence.update({
        where: { id },
        data: {
          heuresTravaillees: (existing.heuresTravaillees ?? 0) + existing.heuresSupBrutes,
          statutHeuresSup: "VALIDEE",
        },
      })
      return NextResponse.json(presence)
    }

    // REJETER_HS : heuresTravaillees reste capé — juste mise à jour du statut
    const presence = await prisma.presence.update({
      where: { id },
      data: { statutHeuresSup: "REJETEE" },
    })
    return NextResponse.json(presence)
  }

  // ── Mise à jour libre (correction d'une présence) ─────────────────────────
  let heuresTravaillees: number | null = null
  let minutesRetard = 0
  let heuresSupBrutes = 0
  let statutHeuresSup = "N/A"

  if (data.heureArrivee && data.heureDepart) {
    const debut  = heureEnMinutes(data.heureArrivee)
    const fin    = heureEnMinutes(data.heureDepart)
    const rawMin = Math.max(0, fin - debut)

    if (data.heureFinShiftRef) {
      const finShift = heureEnMinutes(data.heureFinShiftRef)
      if (fin > finShift) {
        heuresTravaillees = Math.max(0, finShift - debut) / 60
        heuresSupBrutes   = (fin - finShift) / 60
        statutHeuresSup   = "EN_ATTENTE"
      } else {
        heuresTravaillees = rawMin / 60
      }
    } else {
      heuresTravaillees = rawMin / 60
    }
  }

  if (data.heureArrivee && data.heureReferenceDebut) {
    const arrivee   = heureEnMinutes(data.heureArrivee)
    const reference = heureEnMinutes(data.heureReferenceDebut)
    minutesRetard = Math.max(0, arrivee - reference)
  }

  const presence = await prisma.presence.update({
    where: { id },
    data: {
      heureArrivee: data.heureArrivee || null,
      heureDepart: data.heureDepart || null,
      heuresTravaillees,
      minutesRetard,
      statut: data.statut ?? (minutesRetard > 0 ? "RETARD" : "PRESENT"),
      notes: data.notes || null,
      heuresSupBrutes,
      statutHeuresSup,
      heureFinShiftRef: data.heureFinShiftRef || null,
    },
  })

  return NextResponse.json(presence)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "RH", "RESPONSABLE"])
  if (error) return error

  const { id } = await params
  await prisma.presence.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
