import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

async function auditLog(dossierId: string, auteurId: string, auteurNom: string, type: string, description: string) {
  await prisma.auditLog.create({ data: { dossierId, auteurId, auteurNom, type, description } })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId    = (session.user as any)?.id as string
  const auteurNom = session.user?.name ?? "Inconnu"

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ message: "Corps invalide" }, { status: 400 }) }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ message: "Aucun fichier fourni" }, { status: 400 })

  const dossierId  = formData.get("dossierId")  as string | null
  const typeDoc    = formData.get("type")        as string | null ?? "AUTRE"
  const employeId  = formData.get("employeId")   as string | null
  const modeRemise = formData.get("modeRemise")  as string | null
  const dateRemise = formData.get("dateRemise")  as string | null

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadBase = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads")
  const uploadDir  = join(uploadBase, "disciplinaire")
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
  const filename = `${Date.now()}-${safeName}`
  await writeFile(join(uploadDir, filename), buffer)

  const doc = await prisma.document.create({
    data: {
      nom:                    file.name,
      type:                   typeDoc,
      url:                    filename,
      taille:                 file.size,
      mimeType:               file.type || null,
      uploadeParId:           userId,
      employeId:              employeId  || null,
      dossierDisciplinaireId: dossierId  || null,
    },
  })

  // ── Transitions de statut ──────────────────────────────────────────────────
  if (dossierId) {
    const current = await prisma.dossierDisciplinaire.findUnique({
      where: { id: dossierId },
      include: {
        employe:    { select: { prenom: true, nom: true } },
        initiateur: { select: { id: true } },
      },
    })

    if (current) {

      // ── Document RH uploadé → DOCUMENT_PRET ─────────────────────────────
      if (typeDoc === "DOCUMENT_RH") {
        await prisma.dossierDisciplinaire.update({
          where: { id: dossierId },
          data:  { statut: "DOCUMENT_PRET", dateEnvoiDocument: new Date() },
        })
        await auditLog(dossierId, userId, auteurNom, "DOC_RH", `Document officiel uploadé par ${auteurNom}`)
        if (current.initiateur?.id) {
          await prisma.notification.create({
            data: {
              userId:    current.initiateur.id,
              type:      "DOCUMENT_PRET",
              titre:     "Document disponible",
              message:   `Le document pour ${current.employe.prenom} ${current.employe.nom} est prêt à transmettre.`,
              dossierId,
            },
          })
        }
      }

      // ── Accusé de réception uploadé ───────────────────────────────────────
      if (typeDoc === "ACCUSE_RECEPTION") {
        await prisma.dossierDisciplinaire.update({
          where: { id: dossierId },
          data: {
            accuseReceptionUrl:  filename,
            modeRemise:          modeRemise || null,
            dateRemiseEffective: dateRemise ? new Date(dateRemise) : new Date(),
          },
        })
        await auditLog(dossierId, userId, auteurNom, "ACCUSE_RECU",
          `Accusé de réception uploadé — mode : ${modeRemise ?? "non précisé"}`)
      }

      // ── Document de décision uploadé ──────────────────────────────────────
      if (typeDoc === "DOCUMENT_DECISION") {
        await prisma.dossierDisciplinaire.update({
          where: { id: dossierId },
          data:  { documentDecisionUrl: filename },
        })
        await auditLog(dossierId, userId, auteurNom, "DECISION", `Document de décision uploadé par ${auteurNom}`)
      }

      // ── Réponse employé uploadée ──────────────────────────────────────────
      if (typeDoc === "REPONSE_EMPLOYE") {
        const now            = new Date()
        const dateAttendue   = current.dateReponseAttendue
        const dansLesDelais  = dateAttendue ? now <= dateAttendue : false

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {
          statut:            "REPONSE_RECUE",
          dateReponseReelle: now,
          statutReponse:     dansLesDelais ? "DANS_DELAI" : "HORS_DELAI",
        }

        if (!dansLesDelais) {
          updateData.sanctionAutoAppliquee = true
          const sanctionAuto = await prisma.dossierDisciplinaire.create({
            data: {
              employeId:         current.employeId,
              type:              "AVERTISSEMENT",
              date:              now,
              motif:             "Non-respect du délai de réponse",
              description:       `Sanction automatique suite au non-respect du délai. Demande du ${new Date(current.date).toLocaleDateString("fr-FR")}. Délai : ${current.delaiReponseJours} j. Reçu le ${now.toLocaleDateString("fr-FR")}.`,
              statut:            "INITIE",
              initiePar:         userId,
              delaiReponseJours: 5,
            },
          })
          updateData.sanctionAutoRef = sanctionAuto.id
          await auditLog(dossierId, userId, auteurNom, "SANCTION_AUTO", "Sanction automatique créée — réponse hors délai")
        }

        await prisma.dossierDisciplinaire.update({ where: { id: dossierId }, data: updateData })
        await auditLog(dossierId, userId, auteurNom, "REPONSE",
          `Réponse de l'employé reçue — ${dansLesDelais ? "DANS les délais" : "HORS délai"}`)

        const rhs = await prisma.user.findMany({ where: { role: { in: ["RH", "ADMIN"] } } })
        if (rhs.length) {
          await prisma.notification.createMany({
            data: rhs.map(u => ({
              userId:    u.id,
              type:      "REPONSE_RECUE",
              titre:     dansLesDelais ? "Réponse reçue — dans les délais" : "Réponse reçue — HORS DÉLAI",
              message:   `${current.employe.prenom} ${current.employe.nom} a répondu ${dansLesDelais ? "dans les délais." : "HORS DÉLAI — sanction automatique appliquée."}`,
              dossierId,
            })),
          })
        }
      }
    }
  }

  return NextResponse.json({ id: doc.id, url: `/api/files/${filename}`, nom: doc.nom, filename }, { status: 201 })
}
