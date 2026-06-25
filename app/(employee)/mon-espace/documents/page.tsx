"use client"

import { useEffect, useState } from "react"
import { FileText, Download, FolderOpen, Loader2, FileImage, File } from "lucide-react"

type Doc = {
  id: string; nom: string; type: string; url: string
  taille: number | null; mimeType: string | null; createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT_RH:  "Document RH",
  CONTRAT:      "Contrat",
  AVENANT:      "Avenant",
  ATTESTATION:  "Attestation",
  AUTRE:        "Autre",
}

function formatBytes(n: number | null) {
  if (!n) return ""
  if (n < 1024)        return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function DocIcon({ mime }: { mime: string | null }) {
  if (mime?.includes("image")) return <FileImage className="h-5 w-5 text-blue-500" />
  if (mime?.includes("pdf"))   return <FileText   className="h-5 w-5 text-red-500"  />
  return <File className="h-5 w-5 text-slate-400" />
}

export default function MesDocumentsPage() {
  const [docs, setDocs]   = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/mon-espace/documents")
      .then(r => r.json())
      .then(d => setDocs(d.documents ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes documents</h1>
        <p className="text-sm text-slate-500 mt-1">Documents mis à disposition par votre service RH</p>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-slate-200" />
          <p className="font-semibold text-slate-500">Aucun document disponible</p>
          <p className="text-sm text-slate-400 mt-1">Vos documents RH apparaîtront ici dès qu'ils seront partagés.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-50">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors group">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <DocIcon mime={doc.mimeType} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{doc.nom}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[doc.type] ?? doc.type}
                  </span>
                  {doc.taille && <span className="text-xs text-slate-400">{formatBytes(doc.taille)}</span>}
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                </div>
              </div>
              <a
                href={`/api/files/${doc.url}`}
                download={doc.nom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all opacity-0 group-hover:opacity-100"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </a>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Pour toute demande de document (attestation de travail, bulletin manquant…), contactez votre service RH.
      </p>
    </div>
  )
}
