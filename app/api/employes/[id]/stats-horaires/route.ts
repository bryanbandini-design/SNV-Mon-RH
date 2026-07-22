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

  // Récupère le jour de repos de l'employé pour savoir s'il travaille sam ou dim
  const employe = await prisma.employe.findUnique({
    where: { id },
    select: { jourRepos: true },
  })
  const jourRepos = employe?.jourRepos ?? null  // "SAMEDI" | "DIMANCHE" | null

  // Jour ouvré = lun-ven + le 6e jour selon le jour de repos
  // jourRepos="DIMANCHE" → repos dim → travaille sam (dow=6)
  // jourRepos="SAMEDI"   → repos sam → travaille dim (dow=0)
  function isJourOuvre(dow: number): boolean {
    if (dow >= 1 && dow <= 5) return true
    if (dow === 6 && jourRepos === "DIMANCHE") return true
    if (dow === 0 && jourRepos === "SAMEDI")   return true
    return false
  }

  // Dates en UTC pur — évite le décalage timezone côté serveur (ex: France UTC+2)
  const debut = new Date(Date.UTC(annee, mois - 1, 1))
  const fin   = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999))

  // "Aujourd'hui" en UTC pour cap au jour J
  const now = new Date()
  const todayEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999))
  const finEffective = new Date(Math.min(fin.getTime(), todayEnd.getTime()))

  // Présences jusqu'au jour J uniquement
  const presences = await prisma.presence.findMany({
    where: { employeId: id, date: { gte: debut, lte: finEffective } },
    orderBy: { date: "asc" },
  })

  // Congés approuvés chevauchant la fenêtre effective
  const congesMois = await prisma.conge.findMany({
    where: {
      employeId: id,
      statut: "APPROUVE",
      dateDebut: { lte: finEffective },
      dateFin:   { gte: debut },
    },
  })

  // Set des jours ouvrés couverts par un congé approuvé
  const congeDays = new Set<string>()
  for (const c of congesMois) {
    const dTime = Math.max(new Date(c.dateDebut).getTime(), debut.getTime())
    const fTime = Math.min(new Date(c.dateFin).getTime(), finEffective.getTime())
    const loop = new Date(dTime)
    while (loop.getTime() <= fTime) {
      if (isJourOuvre(loop.getUTCDay())) congeDays.add(loop.toISOString().slice(0, 10))
      loop.setUTCDate(loop.getUTCDate() + 1)
    }
  }

  // Map des présences par date (clé = "YYYY-MM-DD" UTC)
  const presenceByDate = new Map<string, typeof presences[0]>()
  for (const p of presences) {
    presenceByDate.set(new Date(p.date).toISOString().slice(0, 10), p)
  }

  // ── Analyse jour par jour en UTC (debut → finEffective) ───────────────────
  let joursOuvres       = 0
  let joursConge        = 0  // congé approuvé hors dénominateur
  let joursAttendu      = 0  // dénominateur réel
  let nbPresent         = 0
  let nbRetard          = 0
  let nbAbsentExplicite = 0  // statut ABSENT saisi manuellement
  let nbAbsentNonSaisi  = 0  // jour ouvré attendu sans aucune saisie
  let nbCongePresence   = 0  // statut CONGE saisi manuellement
  let nbJourOff         = 0  // statut JOUR_OFF

  const cur = new Date(debut.getTime())
  while (cur.getTime() <= finEffective.getTime()) {
    const dow = cur.getUTCDay()
    if (isJourOuvre(dow)) {
      joursOuvres++
      const key = cur.toISOString().slice(0, 10)
      const p = presenceByDate.get(key)

      if (congeDays.has(key)) {
        joursConge++
      } else if (!p) {
        joursAttendu++
        nbAbsentNonSaisi++
      } else {
        switch (p.statut) {
          case "PRESENT":  joursAttendu++; nbPresent++;         break
          case "RETARD":   joursAttendu++; nbRetard++;          break
          case "ABSENT":   joursAttendu++; nbAbsentExplicite++; break
          case "CONGE":    nbCongePresence++; break
          case "JOUR_OFF": nbJourOff++;      break
        }
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const totalAbsences   = nbAbsentExplicite + nbAbsentNonSaisi
  const nbPresentsTotal = nbPresent + nbRetard
  const nbSaisies       = presences.filter(p => p.saisieManuelle).length
  const tauxPresence    = joursAttendu > 0
    ? Math.round((nbPresentsTotal / joursAttendu) * 100)
    : 100

  const totalMinRetard   = presences.reduce((s, p) => s + (p.minutesRetard ?? 0), 0)
  const totalHeures      = presences.reduce((s, p) => s + (p.heuresTravaillees ?? 0), 0)
  const totalHSValidees  = presences
    .filter(p => p.statutHeuresSup === "VALIDEE")
    .reduce((s, p) => s + p.heuresSupBrutes, 0)
  const totalHSEnAttente = presences
    .filter(p => p.statutHeuresSup === "EN_ATTENTE")
    .reduce((s, p) => s + p.heuresSupBrutes, 0)

  // ── Score ponctualité (1–5) ────────────────────────────────────────────────
  let score = 5.0
  if (totalAbsences >= 1) score -= 0.5
  if (totalAbsences >= 3) score -= 0.5
  if (totalAbsences >= 5) score -= 1.0
  if (totalAbsences >= 8) score -= 1.0
  if (nbRetard >= 2)  score -= 0.5
  if (nbRetard >= 5)  score -= 0.5
  if (nbRetard >= 8)  score -= 0.5
  if (nbRetard >= 12) score -= 0.5
  if (totalMinRetard >= 60)  score -= 0.25
  if (totalMinRetard >= 180) score -= 0.25
  if (totalMinRetard >= 360) score -= 0.25
  if (totalHSValidees >= 5)  score += 0.25
  if (totalHSValidees >= 15) score += 0.25
  const scorePonctualite = Math.round(Math.min(5, Math.max(1, score)))

  return NextResponse.json({
    mois, annee,
    joursOuvres, joursConge, joursAttendu,
    nbPresent, nbRetard, nbAbsent: totalAbsences,
    nbConge: nbCongePresence, nbJourOff, nbSaisies,
    nbPresentsTotal, tauxPresence,
    totalMinRetard, totalHeures, totalHSValidees, totalHSEnAttente,
    scorePonctualite,
    presences: presences.map(p => ({
      id:                p.id,
      date:              p.date,
      statut:            p.statut,
      heureArrivee:      p.heureArrivee,
      heureDepart:       p.heureDepart,
      heuresTravaillees: p.heuresTravaillees,
      minutesRetard:     p.minutesRetard,
      heuresSupBrutes:   p.heuresSupBrutes,
      statutHeuresSup:   p.statutHeuresSup,
      saisieManuelle:    p.saisieManuelle,
      notes:             p.notes,
    })),
  })
}
