import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const CORS = {
  "Access-Control-Allow-Origin":  process.env.SANOVIA_URL ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      offreId:      string
      prenom:       string
      nom:          string
      email?:       string
      telephone?:   string
      ville?:       string
      pays?:        string
      dateNaissance?: string
      experiences?: Array<{ poste: string; entreprise: string; debut: string; fin: string; actuel: boolean; description: string }>
      formations?:  Array<{ diplome: string; etablissement: string; annee: string }>
      competences?: string
      langues?:     Array<{ langue: string; niveau: string }>
      motivation?:  string
    }

    const { offreId, prenom, nom } = body
    if (!offreId || !prenom || !nom) {
      return NextResponse.json({ success: false, error: "Champs requis manquants" }, { status: 400, headers: CORS })
    }

    /* Vérifier que l'offre existe */
    const offre = await prisma.offre.findUnique({ where: { id: offreId } })
    if (!offre) {
      return NextResponse.json({ success: false, error: "Offre introuvable" }, { status: 404, headers: CORS })
    }

    /* Construire le commentaire structuré */
    const sections: string[] = []

    if (body.ville || body.pays) {
      sections.push(`📍 Localisation : ${[body.ville, body.pays].filter(Boolean).join(", ")}`)
    }
    if (body.dateNaissance) {
      sections.push(`🎂 Date de naissance : ${new Date(body.dateNaissance).toLocaleDateString("fr-FR")}`)
    }

    if (body.experiences?.length) {
      const exps = body.experiences.filter(e => e.poste || e.entreprise)
      if (exps.length) {
        sections.push("── Expériences professionnelles ──")
        exps.forEach(e => {
          const periode = e.debut
            ? `${e.debut}${e.actuel ? " → aujourd'hui" : e.fin ? ` → ${e.fin}` : ""}`
            : ""
          sections.push(`• ${e.poste || "Poste non précisé"} chez ${e.entreprise || "—"}${periode ? ` (${periode})` : ""}`)
          if (e.description) sections.push(`  ${e.description}`)
        })
      }
    }

    if (body.formations?.length) {
      const forms = body.formations.filter(f => f.diplome || f.etablissement)
      if (forms.length) {
        sections.push("── Formation ──")
        forms.forEach(f => {
          sections.push(`• ${f.diplome || "Diplôme non précisé"} — ${f.etablissement || ""}${f.annee ? ` (${f.annee})` : ""}`)
        })
      }
    }

    if (body.competences?.trim()) {
      sections.push("── Compétences ──")
      sections.push(body.competences)
    }

    if (body.langues?.length) {
      const langs = body.langues.filter(l => l.langue)
      if (langs.length) {
        sections.push("── Langues ──")
        sections.push(langs.map(l => `${l.langue} (${l.niveau})`).join(", "))
      }
    }

    if (body.motivation?.trim()) {
      sections.push("── Lettre de motivation ──")
      sections.push(body.motivation)
    }

    const commentaire = sections.join("\n")

    const candidat = await prisma.candidat.create({
      data: {
        offreId,
        prenom,
        nom,
        email:      body.email      ?? null,
        telephone:  body.telephone  ?? null,
        source:     "SITE_WEB",
        statut:     "RECU",
        commentaire: commentaire || null,
      },
    })

    return NextResponse.json({ success: true, candidatId: candidat.id }, { headers: CORS })
  } catch (err) {
    console.error("Public candidatures error:", err)
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500, headers: CORS })
  }
}
