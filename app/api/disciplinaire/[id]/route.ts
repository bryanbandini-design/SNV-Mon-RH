import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function log(dossierId: string, auteurId: string, auteurNom: string, type: string, description: string, metadata?: object) {
  await prisma.auditLog.create({
    data: {
      dossierId,
      auteurId,
      auteurNom,
      type,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}

async function notifyRH(dossierId: string, type: string, titre: string, message: string) {
  const users = await prisma.user.findMany({ where: { role: { in: ["RH", "ADMIN"] } } })
  if (users.length) {
    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, type, titre, message, dossierId })),
    })
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  const dossier = await prisma.dossierDisciplinaire.findUnique({
    where: { id },
    include: {
      employe:      { select: { prenom: true, nom: true, matricule: true, poste: true } },
      initiateur:   { select: { name: true, email: true } },
      documents:    true,
      auditLogs:    { orderBy: { createdAt: "asc" } },
      notesInternes: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!dossier) return NextResponse.json({ message: "Introuvable" }, { status: 404 })
  return NextResponse.json(dossier)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId    = (session.user as any)?.id  as string
  const auteurNom = session.user?.name ?? "Inconnu"
  const data      = await req.json()

  const current = await prisma.dossierDisciplinaire.findUnique({
    where: { id },
    include: {
      employe:    { select: { prenom: true, nom: true } },
      initiateur: { select: { id: true, name: true } },
    },
  })
  if (!current) return NextResponse.json({ message: "Introuvable" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {}

  switch (data.action) {

    // ── RH : document officiel uploadé ────────────────────────────────────
    case "DOCUMENT_UPLOADED":
      update.statut            = "DOCUMENT_PRET"
      update.dateEnvoiDocument = new Date()
      if (current.initiateur?.id) {
        await prisma.notification.create({
          data: {
            userId:    current.initiateur.id,
            type:      "DOCUMENT_PRET",
            titre:     "Document disponible",
            message:   `Le document pour ${current.employe.prenom} ${current.employe.nom} est prêt à être transmis.`,
            dossierId: id,
          },
        })
      }
      await log(id, userId, auteurNom, "DOC_RH", `Document RH uploadé par ${auteurNom}`)
      break

    // ── RESPONSABLE : accusé de réception uploadé ─────────────────────────
    case "ACCUSE_RECU":
      update.accuseReceptionUrl  = data.filename
      update.modeRemise          = data.modeRemise
      update.dateRemiseEffective = data.dateRemise ? new Date(data.dateRemise) : new Date()
      await log(id, userId, auteurNom, "ACCUSE_RECU",
        `Accusé de réception uploadé — mode : ${data.modeRemise ?? "non précisé"}`,
        { modeRemise: data.modeRemise })
      break

    // ── RESPONSABLE : refus de signer ─────────────────────────────────────
    case "REFUS_RECEPTION":
      update.refusReception     = true
      update.refusReceptionNote = data.note ?? null
      await log(id, userId, auteurNom, "REFUS_RECEPTION",
        `Refus de réception signalé par ${auteurNom}${data.note ? ` — ${data.note}` : ""}`)
      await notifyRH(id, "ENVOYE_EMPLOYE", "Refus de réception signalé",
        `${current.employe.prenom} ${current.employe.nom} a refusé de signer l'accusé de réception.`)
      break

    // ── RESPONSABLE : transmis à l'employé ────────────────────────────────
    case "ENVOYE_EMPLOYE": {
      const dateEnvoi    = new Date()
      const delai        = current.delaiReponseJours ?? 5
      const dateAttendue = new Date(dateEnvoi)
      dateAttendue.setDate(dateAttendue.getDate() + delai)
      update.statut              = "EN_ATTENTE_REP"
      update.dateEnvoiEmploye    = dateEnvoi
      update.dateReponseAttendue = dateAttendue
      update.statutReponse       = "EN_ATTENTE"
      if (data.modeRemise) update.modeRemise = data.modeRemise
      await log(id, userId, auteurNom, "TRANSMISSION",
        `Document transmis à l'employé — délai : ${delai} j, échéance ${dateAttendue.toLocaleDateString("fr-FR")}`,
        { delai, dateAttendue: dateAttendue.toISOString() })
      await notifyRH(id, "ENVOYE_EMPLOYE", "Document transmis à l'employé",
        `Le responsable a transmis le document à ${current.employe.prenom} ${current.employe.nom}. Délai : ${delai} jours (avant le ${dateAttendue.toLocaleDateString("fr-FR")}).`)
      break
    }

    // ── RESPONSABLE : réponse scannée ─────────────────────────────────────
    case "REPONSE_UPLOADEE": {
      const now            = new Date()
      const dateAttendue   = current.dateReponseAttendue
      const dansLesDelais  = dateAttendue ? now <= dateAttendue : false
      update.statut            = "REPONSE_RECUE"
      update.dateReponseReelle = now
      update.statutReponse     = dansLesDelais ? "DANS_DELAI" : "HORS_DELAI"
      if (!dansLesDelais) {
        update.sanctionAutoAppliquee = true
        const sanctionAuto = await prisma.dossierDisciplinaire.create({
          data: {
            employeId:         current.employeId,
            type:              "AVERTISSEMENT",
            date:              now,
            motif:             "Non-respect du délai de réponse",
            description:       `Sanction automatique suite au non-respect du délai de réponse à la demande d'explication du ${new Date(current.date).toLocaleDateString("fr-FR")}.`,
            statut:            "INITIE",
            initiePar:         userId,
            delaiReponseJours: 5,
          },
        })
        update.sanctionAutoRef = sanctionAuto.id
        await log(id, userId, auteurNom, "SANCTION_AUTO", "Sanction automatique créée pour réponse hors délai")
      }
      await log(id, userId, auteurNom, "REPONSE",
        `Réponse de l'employé reçue — ${dansLesDelais ? "DANS les délais" : "HORS délai"}`,
        { dansLesDelais })
      await notifyRH(id, "REPONSE_RECUE",
        dansLesDelais ? "Réponse reçue — dans les délais" : "Réponse reçue — HORS DÉLAI",
        `${current.employe.prenom} ${current.employe.nom} a répondu ${dansLesDelais ? "dans les délais." : "HORS DÉLAI — sanction automatique appliquée."}`)
      break
    }

    // ── RH : enregistrer l'analyse et la décision ─────────────────────────
    case "ANALYSER": {
      update.appreciationRH           = data.appreciationRH
      update.decisionFinale           = data.decisionFinale
      update.sanctionRetenue          = data.sanctionRetenue ?? null
      update.dateNotificationDecision = data.dateNotification ? new Date(data.dateNotification) : new Date()
      if (data.statut) update.statut  = data.statut  // peut passer à CLOS

      const DECISION_LABEL: Record<string, string> = {
        ACCEPTEE:               "Explication acceptée → classement sans suite",
        PARTIELLEMENT_ACCEPTEE: "Explication partiellement acceptée → sanction allégée",
        REJETEE:                "Explication rejetée → sanction maintenue",
      }
      await log(id, userId, auteurNom, "ANALYSE",
        `Analyse RH terminée — Décision : ${DECISION_LABEL[data.decisionFinale] ?? data.decisionFinale}`,
        { decision: data.decisionFinale, sanction: data.sanctionRetenue })

      if (data.statut === "CLOS") {
        await log(id, userId, auteurNom, "CLOTURE", `Dossier clôturé par ${auteurNom}`)
      }

      // Notifier le responsable initiateur
      if (current.initiateur?.id) {
        await prisma.notification.create({
          data: {
            userId:    current.initiateur.id,
            type:      "REPONSE_RECUE",
            titre:     "Analyse RH disponible",
            message:   `La décision RH a été rendue pour ${current.employe.prenom} ${current.employe.nom} : ${DECISION_LABEL[data.decisionFinale] ?? data.decisionFinale}.`,
            dossierId: id,
          },
        })
      }
      break
    }

    // ── RH : document de décision uploadé ────────────────────────────────
    case "DECISION_UPLOADED":
      update.documentDecisionUrl = data.filename
      await log(id, userId, auteurNom, "DECISION", `Document de décision uploadé par ${auteurNom}`)
      break

    // ── RH : clôture ──────────────────────────────────────────────────────
    case "CLORE":
      update.statut    = "CLOS"
      update.suites    = data.suites    ?? current.suites
      update.sanctions = data.sanctions ?? current.sanctions
      await log(id, userId, auteurNom, "CLOTURE", `Dossier clôturé par ${auteurNom}`)
      break

    // ── Patch générique ────────────────────────────────────────────────────
    default:
      if (data.statut)    update.statut    = data.statut
      if (data.sanctions) update.sanctions = data.sanctions
      if (data.suites)    update.suites    = data.suites
  }

  const updated = await prisma.dossierDisciplinaire.update({ where: { id }, data: update })
  return NextResponse.json(updated)
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })
  const { id } = await params
  await prisma.dossierDisciplinaire.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
