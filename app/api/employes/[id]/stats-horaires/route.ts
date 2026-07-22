import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["ADMIN", "RH", "RESPONSABLE"])
  if (error) return error

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const mois  = parseInt(searchParams.get("mois")  ?? String(new Date().getMonth() + 1))
  const annee = parseInt(searchParams.get("annee") ?? String(new Date().getFullYear()))

  const debut = new Date(annee, mois - 1, 1, 0, 0, 0)
  const fin   = new Date(annee, mois, 0, 23, 59, 59)

  const presences = await prisma.presence.findMany({
    where: { employeId: id, date: { gte: debut, lte: fin } },
    orderBy: { date: "asc" },
  })

  // Jours ouvrés du mois (lun–ven)
  let joursOuvres = 0
  const cur = new Date(debut)
  while (cur <= fin) {
    const dow = cur.getDay()
    if (dow >= 1 && dow <= 5) joursOuvres++
    cur.setDate(cur.getDate() + 1)
  }

  // Congés approuvés sur ce mois → réduisent les jours ouvrés attendus
  const congesMois = await prisma.conge.findMany({
    where: {
      employeId: id,
      statut: "APPROUVE",
      dateDebut: { lte: fin },
      dateFin:   { gte: debut },
    },
  })
  let joursConge = 0
  for (const c of congesMois) {
    const d = new Date(Math.max(new Date(c.dateDebut).getTime(), debut.getTime()))
    const f = new Date(Math.min(new Date(c.dateFin).getTime(), fin.getTime()))
    const loop = new Date(d)
    while (loop <= f) {
      const dow = loop.getDay()
      if (dow >= 1 && dow <= 5) joursConge++
      loop.setDate(loop.getDate() + 1)
    }
  }
  const joursAttendu = Math.max(0, joursOuvres - joursConge)

  // Agrégats
  const nbPresent      = presences.filter(p => p.statut === "PRESENT").length
  const nbRetard       = presences.filter(p => p.statut === "RETARD").length
  const nbAbsent       = presences.filter(p => p.statut === "ABSENT").length
  const nbConge        = presences.filter(p => p.statut === "CONGE").length
  const nbJourOff      = presences.filter(p => p.statut === "JOUR_OFF").length
  const nbSaisies      = presences.filter(p => p.saisieManuelle).length
  const nbPresentsTotal = nbPresent + nbRetard

  // Absences non saisies = jours attendus sans aucune saisie PRESENT/RETARD/CONGE
  const joursAvecSaisie = new Set(
    presences
      .filter(p => ["PRESENT", "RETARD", "CONGE"].includes(p.statut))
      .map(p => new Date(p.date).toISOString().slice(0, 10))
  ).size
  const absencesNonSaisies = Math.max(0, joursAttendu - joursAvecSaisie)
  const totalAbsences = nbAbsent + absencesNonSaisies

  const totalMinRetard     = presences.reduce((s, p) => s + (p.minutesRetard ?? 0), 0)
  const totalHeures        = presences.reduce((s, p) => s + (p.heuresTravaillees ?? 0), 0)
  const totalHSValidees    = presences
    .filter(p => p.statutHeuresSup === "VALIDEE")
    .reduce((s, p) => s + p.heuresSupBrutes, 0)
  const totalHSEnAttente   = presences
    .filter(p => p.statutHeuresSup === "EN_ATTENTE")
    .reduce((s, p) => s + p.heuresSupBrutes, 0)

  const tauxPresence = joursAttendu > 0
    ? Math.round((nbPresentsTotal / joursAttendu) * 100)
    : 100

  // ── Score ponctualité/assiduité (1-5) ────────────────────────────────────
  // Basé sur : taux de présence + nombre/durée des retards
  let score = 5.0

  // Pénalité absences (hors congés)
  if (totalAbsences >= 1)  score -= 0.5
  if (totalAbsences >= 3)  score -= 0.5
  if (totalAbsences >= 5)  score -= 1.0
  if (totalAbsences >= 8)  score -= 1.0

  // Pénalité retards (nombre)
  if (nbRetard >= 2)  score -= 0.5
  if (nbRetard >= 5)  score -= 0.5
  if (nbRetard >= 8)  score -= 0.5
  if (nbRetard >= 12) score -= 0.5

  // Pénalité durée cumulée retards
  if (totalMinRetard >= 60)  score -= 0.25
  if (totalMinRetard >= 180) score -= 0.25
  if (totalMinRetard >= 360) score -= 0.25

  // Bonus heures sup validées (investissement)
  if (totalHSValidees >= 5)  score += 0.25
  if (totalHSValidees >= 15) score += 0.25

  const scorePonctualite = Math.round(Math.min(5, Math.max(1, score)))

  return NextResponse.json({
    mois, annee,
    joursOuvres, joursConge, joursAttendu,
    nbPresent, nbRetard, nbAbsent: totalAbsences, nbConge, nbJourOff, nbSaisies,
    nbPresentsTotal, tauxPresence,
    totalMinRetard, totalHeures, totalHSValidees, totalHSEnAttente,
    scorePonctualite,
    presences: presences.map(p => ({
      id:              p.id,
      date:            p.date,
      statut:          p.statut,
      heureArrivee:    p.heureArrivee,
      heureDepart:     p.heureDepart,
      heuresTravaillees: p.heuresTravaillees,
      minutesRetard:   p.minutesRetard,
      heuresSupBrutes: p.heuresSupBrutes,
      statutHeuresSup: p.statutHeuresSup,
      saisieManuelle:  p.saisieManuelle,
      notes:           p.notes,
    })),
  })
}
