import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guards"

export async function GET(req: Request) {
  const { error } = await requireRole(["ADMIN", "RH", "RESPONSABLE"])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const mois  = parseInt(searchParams.get("mois")  ?? String(new Date().getMonth() + 1))
  const annee = parseInt(searchParams.get("annee") ?? String(new Date().getFullYear()))

  const debut = new Date(Date.UTC(annee, mois - 1, 1))
  const fin   = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999))
  const now   = new Date()
  const todayEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999))
  const finEffective = new Date(Math.min(fin.getTime(), todayEnd.getTime()))

  const employes = await prisma.employe.findMany({
    where: { statut: "ACTIF" },
    select: { id: true, prenom: true, nom: true, matricule: true, poste: true, departement: true, jourRepos: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  })

  const toutes = await prisma.presence.findMany({
    where: { date: { gte: debut, lte: finEffective } },
    select: {
      employeId: true, date: true, statut: true,
      minutesRetard: true, heuresTravaillees: true,
      heuresSupBrutes: true, statutHeuresSup: true,
    },
  })

  const tousConges = await prisma.conge.findMany({
    where: {
      statut: "APPROUVE",
      dateDebut: { lte: finEffective },
      dateFin:   { gte: debut },
    },
    select: { employeId: true, dateDebut: true, dateFin: true },
  })

  function isJourOuvre(dow: number, jourRepos: string | null): boolean {
    if (dow >= 1 && dow <= 5) return true
    if (dow === 6 && jourRepos === "DIMANCHE") return true
    if (dow === 0 && jourRepos === "SAMEDI")   return true
    return false
  }

  const results = employes.map(emp => {
    const presEmp = toutes.filter(p => p.employeId === emp.id)
    const presMap = new Map(presEmp.map(p => [new Date(p.date).toISOString().slice(0, 10), p]))

    const congesEmp = tousConges.filter(c => c.employeId === emp.id)
    const congeDays = new Set<string>()
    for (const c of congesEmp) {
      const dTime = Math.max(new Date(c.dateDebut).getTime(), debut.getTime())
      const fTime = Math.min(new Date(c.dateFin).getTime(), finEffective.getTime())
      const loop  = new Date(dTime)
      while (loop.getTime() <= fTime) {
        if (isJourOuvre(loop.getUTCDay(), emp.jourRepos)) {
          congeDays.add(loop.toISOString().slice(0, 10))
        }
        loop.setUTCDate(loop.getUTCDate() + 1)
      }
    }

    let joursOuvres = 0, joursConge = 0, joursAttendu = 0
    let nbPresent = 0, nbRetard = 0, nbAbsentExplicite = 0, nbAbsentNonSaisi = 0
    let nbConge = 0, nbJourOff = 0

    const seenKeys = new Set<string>()
    const cur = new Date(debut.getTime())
    while (cur.getTime() <= finEffective.getTime()) {
      const dow = cur.getUTCDay()
      if (isJourOuvre(dow, emp.jourRepos)) {
        joursOuvres++
        const key = cur.toISOString().slice(0, 10)
        seenKeys.add(key)
        const p   = presMap.get(key)
        if (congeDays.has(key)) {
          joursConge++
        } else if (!p) {
          joursAttendu++; nbAbsentNonSaisi++
        } else {
          switch (p.statut) {
            case "PRESENT":  joursAttendu++; nbPresent++;          break
            case "RETARD":   joursAttendu++; nbRetard++;           break
            case "ABSENT":   joursAttendu++; nbAbsentExplicite++;  break
            case "CONGE":    nbConge++;                            break
            case "JOUR_OFF": nbJourOff++;                          break
          }
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    // Weekends effectivement travaillés hors planning habituel
    for (const [key, p] of presMap.entries()) {
      if (seenKeys.has(key)) continue
      joursOuvres++; joursAttendu++
      switch (p.statut) {
        case "PRESENT":  nbPresent++;         break
        case "RETARD":   nbRetard++;          break
        case "ABSENT":   nbAbsentExplicite++; break
        case "CONGE":    nbConge++;           break
        case "JOUR_OFF": nbJourOff++;         break
      }
    }

    const totalAbsences   = nbAbsentExplicite + nbAbsentNonSaisi
    const nbPresentsTotal = nbPresent + nbRetard
    const tauxPresence    = joursAttendu > 0 ? Math.round((nbPresentsTotal / joursAttendu) * 100) : 100
    const totalMinRetard  = presEmp.reduce((s, p) => s + (p.minutesRetard ?? 0), 0)
    const totalHeures     = presEmp.reduce((s, p) => s + (p.heuresTravaillees ?? 0), 0)
    const totalHSValidees = presEmp
      .filter(p => p.statutHeuresSup === "VALIDEE")
      .reduce((s, p) => s + p.heuresSupBrutes, 0)
    const totalHSRejetees = presEmp
      .filter(p => p.statutHeuresSup === "REJETEE")
      .reduce((s, p) => s + p.heuresSupBrutes, 0)
    const totalHSAttente  = presEmp
      .filter(p => p.statutHeuresSup === "EN_ATTENTE")
      .reduce((s, p) => s + p.heuresSupBrutes, 0)
    const totalHSBrutes      = totalHSValidees + totalHSRejetees + totalHSAttente
    const heuresEffectives   = totalHeures + totalHSValidees

    return {
      id: emp.id,
      prenom: emp.prenom,
      nom: emp.nom,
      matricule: emp.matricule,
      poste: emp.poste,
      departement: emp.departement,
      joursOuvres,
      joursAttendu,
      joursConge,
      nbPresentsTotal,
      nbRetard,
      nbAbsent: totalAbsences,
      nbConge,
      nbJourOff,
      tauxPresence,
      totalMinRetard,
      totalHeures,
      totalHSBrutes,
      totalHSValidees,
      totalHSRejetees,
      totalHSAttente,
      heuresEffectives,
    }
  })

  return NextResponse.json({ mois, annee, employes: results })
}
