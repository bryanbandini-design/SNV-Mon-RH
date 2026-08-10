import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { heureEnMinutes, calculerHS } from "@/lib/utils"
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
      const dow = new Date(existing.date).getUTCDay()
      const hs  = calculerHS({
        heureArrivee:       existing.heureArrivee,
        heureDepart:        existing.heureDepart,
        heureDebutShiftRef: existing.heureDebutShiftRef,
        heureFinShiftRef:   existing.heureFinShiftRef,
        isWeekend:          dow === 0 || dow === 6,
      })
      updateData.heuresTravaillees = hs.heuresTravaillees
      if (existing.heuresSupBrutes === 0) {
        updateData.heuresSupBrutes = hs.heuresSupBrutes
        updateData.statutHeuresSup = hs.statutHeuresSup
      }
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
      // HS validées : statut seul. heuresTravaillees reste capé (shift uniquement).
      // Les totaux incluent les HS via heuresSupBrutes + statutHeuresSup=VALIDEE.
      const presence = await prisma.presence.update({
        where: { id },
        data: { statutHeuresSup: "VALIDEE" },
      })
      return NextResponse.json(presence)
    }

    // REJETER_HS : HS annulées — statut uniquement, aucun impact sur heuresTravaillees
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

  const heureDebutRef: string | null = data.heureDebutShiftRef ?? data.heureReferenceDebut ?? null

  if (data.heureArrivee && data.heureDepart) {
    const existing2 = await prisma.presence.findUnique({ where: { id }, select: { date: true } })
    const dow       = existing2 ? new Date(existing2.date).getUTCDay() : 1
    const isWeekend = dow === 0 || dow === 6
    const hs = calculerHS({
      heureArrivee:       data.heureArrivee,
      heureDepart:        data.heureDepart,
      heureDebutShiftRef: heureDebutRef,
      heureFinShiftRef:   data.heureFinShiftRef ?? null,
      isWeekend,
    })
    heuresTravaillees = hs.heuresTravaillees
    heuresSupBrutes   = hs.heuresSupBrutes
    statutHeuresSup   = hs.statutHeuresSup
  }

  if (data.heureArrivee && heureDebutRef) {
    const arrivee   = heureEnMinutes(data.heureArrivee)
    const reference = heureEnMinutes(heureDebutRef)
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
      heureDebutShiftRef: heureDebutRef || null,
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
