/**
 * ZKTeco ADMS Protocol — /iclock/cdata
 *
 * GET  ?SN=<serial>&options=all  → Handshake initial / enregistrement
 * POST ?SN=<serial>&table=ATTLOG → Push des pointages empreinte
 *
 * Format ATTLOG (text/plain) :
 *   PIN\tYYYY-MM-DD HH:MM:SS\tStatus\tVerify\tWorkCode\tReserved\r\n
 *
 * Status : 0=Entrée  1=Sortie  2=Pause-sortie  3=Pause-retour  4=HS-entrée  5=HS-sortie
 * Verify : 0=Mdp  1=Empreinte  2=Carte  4=Face  6=Mdp+Empreinte
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"

// ── Mapping Verify ZKTeco → label lisible ──────────────────────────────────
const VERIFY_LABELS: Record<number, string> = {
  0: "mdp",
  1: "empreinte",
  2: "carte",
  4: "face",
  6: "mdp+empreinte",
  15: "face",
}

// ── Vérifie que le device est autorisé (actif en base) ────────────────────
// Si le device est inconnu, il est créé avec actif=false jusqu'à validation manuelle
async function getOrCreateDevice(sn: string) {
  const existing = await prisma.zktecoDevice.findUnique({ where: { serialNumber: sn } })
  if (existing) {
    await prisma.zktecoDevice.update({ where: { serialNumber: sn }, data: { lastSyncAt: new Date() } })
    return existing
  }
  // Nouveau terminal — créé comme inactif en attente de validation RH
  return prisma.zktecoDevice.create({
    data: { serialNumber: sn, nom: `Terminal ${sn} (à valider)`, actif: false, lastSyncAt: new Date() },
  })
}

// ── GET — Handshake initial ────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sn = searchParams.get("SN") ?? "UNKNOWN"

  await getOrCreateDevice(sn)

  // Réponse au format texte attendu par ZKTeco ADMS
  const body = [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=0",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=0",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;23:59",
    "TransInterval=1",
    "TransFlag=TransData AttLog OpLog",
    "TimeZone=1",
    "Realtime=1",
    "Encrypt=None",
    "",
  ].join("\r\n")

  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
  })
}

// ── POST — Push des enregistrements de présence ───────────────────────────
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const sn    = searchParams.get("SN")    ?? "UNKNOWN"
  const table = searchParams.get("table") ?? ""

  // On ne traite que les logs de présence
  if (table !== "ATTLOG") {
    return new Response("OK: 0", { headers: { "Content-Type": "text/plain" } })
  }

  const device = await getOrCreateDevice(sn)

  // Refuser les pointages des terminaux non validés
  if (!device.actif) {
    return new Response("ERROR: DEVICE_NOT_AUTHORIZED", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    })
  }

  const body = await req.text()

  const lines = body
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)

  let processed = 0

  for (const line of lines) {
    const parts = line.split("\t")
    if (parts.length < 4) continue

    const [pin, datetime, statusStr, verifyStr] = parts
    const status = parseInt(statusStr, 10)
    const verify = parseInt(verifyStr,  10)

    if (!pin || !datetime) continue

    // Résoudre l'employé par son PIN ZKTeco
    const employe = await prisma.employe.findUnique({
      where: { zktecoPin: pin },
    })
    if (!employe) continue  // PIN non mappé — on ignore

    // Parser la date ZKTeco (YYYY-MM-DD HH:MM:SS)
    const datePointage = new Date(datetime.replace(" ", "T"))
    if (isNaN(datePointage.getTime())) continue

    const verifyMethod = VERIFY_LABELS[verify] ?? "inconnu"

    if (status === 0) {
      // ── ENTRÉE ──────────────────────────────────────────────────
      // Vérifier s'il y a déjà un pointage ouvert ce jour
      const dayStart = new Date(datePointage)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const existant = await prisma.pointage.findFirst({
        where: {
          employeId:  employe.id,
          dateEntree: { gte: dayStart, lt: dayEnd },
          source:     "ZKTECO",
        },
      })
      if (existant) continue  // déjà pointé aujourd'hui — doublon

      const pointage = await prisma.pointage.create({
        data: {
          employeId:     employe.id,
          dateEntree:    datePointage,
          faceVerified:  verify === 1 || verify === 4,
          statut:        "CONFIRME",
          verifyMethod,
          source:        "ZKTECO",
          zktecoDeviceId: device.id,
        },
      })

      await logActivity({
        action:      "POINTAGE_ENTREE",
        module:      "POINTAGE",
        description: `Entrée ZKTeco (${verifyMethod}) : ${employe.prenom} ${employe.nom} — ${datePointage.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        entityId:    pointage.id,
        entityType:  "Pointage",
        metadata:    { source: "ZKTECO", sn, pin, verifyMethod },
      })

    } else if (status === 1) {
      // ── SORTIE ───────────────────────────────────────────────────
      const dayStart = new Date(datePointage)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const pointageOuvert = await prisma.pointage.findFirst({
        where: {
          employeId:  employe.id,
          dateEntree: { gte: dayStart, lt: dayEnd },
          dateSortie: null,
          source:     "ZKTECO",
        },
        orderBy: { dateEntree: "desc" },
      })

      if (pointageOuvert) {
        await prisma.pointage.update({
          where: { id: pointageOuvert.id },
          data:  { dateSortie: datePointage, statut: "SORTI" },
        })

        await logActivity({
          action:      "POINTAGE_SORTIE",
          module:      "POINTAGE",
          description: `Sortie ZKTeco (${verifyMethod}) : ${employe.prenom} ${employe.nom} — ${datePointage.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
          entityId:    pointageOuvert.id,
          entityType:  "Pointage",
          metadata:    { source: "ZKTECO", sn, pin, verifyMethod },
        })
      }
    }

    processed++
  }

  // Mettre à jour le compteur du device
  await prisma.zktecoDevice.update({
    where: { id: device.id },
    data:  {
      totalPushes: { increment: processed },
      lastSyncAt:  new Date(),
    },
  })

  return new Response(`OK: ${processed}`, {
    headers: { "Content-Type": "text/plain" },
  })
}
