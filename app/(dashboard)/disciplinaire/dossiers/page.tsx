"use client"

import { useState, useEffect } from "react"
import {
  FolderOpen, ChevronRight, FileText, Download,
  AlertTriangle, Clock, CheckCircle, Search,
} from "lucide-react"
import { Input }    from "@/components/ui/input"
import { formatDate } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Document = { id: string; nom: string; type: string; url: string; createdAt: string }
type Dossier  = {
  id: string; type: string; date: string; motif: string; statut: string
  sanctionAutoAppliquee: boolean; initiateur: { name: string } | null; documents: Document[]
}
type Employe  = {
  id: string; prenom: string; nom: string; matricule: string
  poste: string; departement: string | null; statut: string
  dossiersDisciplinaires: Dossier[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; color: string; icon: string }> = {
  DEMANDE_EXPLICATION: { label: "Demande d'explication", color: "#d97706", icon: "?" },
  AVERTISSEMENT:       { label: "Avertissement",         color: "#ea580c", icon: "!" },
  BLAME:               { label: "Blâme",                 color: "#dc2626", icon: "‼" },
  MISE_EN_DEMEURE:     { label: "Mise en demeure",       color: "#b91c1c", icon: "⚠" },
  MISE_A_PIED:         { label: "Mise à pied",           color: "#991b1b", icon: "⛔" },
  LICENCIEMENT:        { label: "Licenciement",          color: "#7f1d1d", icon: "✕" },
}

function gravite(type: string): number {
  const order = ["DEMANDE_EXPLICATION", "AVERTISSEMENT", "BLAME", "MISE_EN_DEMEURE", "MISE_A_PIED", "LICENCIEMENT"]
  return order.indexOf(type)
}

function niveauRisque(dossiers: Dossier[]): { label: string; color: string; bg: string } {
  const actifs = dossiers.filter(d => d.statut !== "CLOS")
  const maxGravite = actifs.length === 0 ? -1 : Math.max(...actifs.map(d => gravite(d.type)))
  if (maxGravite >= 4) return { label: "Critique",  color: "#7f1d1d", bg: "#fee2e2" }
  if (maxGravite >= 2) return { label: "Élevé",     color: "#dc2626", bg: "#fef2f2" }
  if (maxGravite >= 1) return { label: "Modéré",    color: "#d97706", bg: "#fffbeb" }
  if (maxGravite >= 0) return { label: "Faible",    color: "#2563eb", bg: "#eff6ff" }
  return                       { label: "Aucun",    color: "#64748b", bg: "#f1f5f9" }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DossiersPage() {
  const [employes,  setEmployes]  = useState<Employe[]>([])
  const [search,    setSearch]    = useState("")
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/disciplinaire/archive")
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setEmployes(d) })
  }, [])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = employes.filter(e => {
    const q = search.toLowerCase()
    return !q || `${e.prenom} ${e.nom} ${e.matricule} ${e.poste}`.toLowerCase().includes(q)
  })

  const total         = filtered.reduce((s, e) => s + e.dossiersDisciplinaires.length, 0)
  const totalActifs   = filtered.reduce((s, e) => s + e.dossiersDisciplinaires.filter(d => d.statut !== "CLOS").length, 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dossiers employés</h1>
        <p className="text-sm text-slate-500 mt-1">
          Archive automatique · {filtered.length} employé(s) concerné(s) · {total} procédure(s) dont{" "}
          <span className={totalActifs > 0 ? "text-red-600 font-semibold" : ""}>{totalActifs} active(s)</span>
        </p>
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Rechercher un employé…" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-slate-500">
            {search ? "Aucun employé trouvé" : "Aucun dossier disciplinaire enregistré"}
          </p>
          <p className="text-sm mt-1">Les dossiers apparaissent automatiquement dès qu&apos;une procédure est initiée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => {
            const risk   = niveauRisque(emp.dossiersDisciplinaires)
            const isOpen = expanded.has(emp.id)
            const actifs = emp.dossiersDisciplinaires.filter(d => d.statut !== "CLOS")
            const clos   = emp.dossiersDisciplinaires.filter(d => d.statut === "CLOS")
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                {/* En-tête employé */}
                <button className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggle(emp.id)}>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}>
                    {emp.prenom[0]}{emp.nom[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{emp.prenom} {emp.nom}</span>
                      <span className="text-xs text-slate-400">{emp.matricule}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: risk.bg, color: risk.color }}>
                        Risque : {risk.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {emp.poste}{emp.departement ? ` · ${emp.departement}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
                    {actifs.length > 0 && (
                      <span className="font-semibold text-red-600">{actifs.length} actif(s)</span>
                    )}
                    <span>{emp.dossiersDisciplinaires.length} procédure(s)</span>
                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {/* Détail dossiers */}
                <div className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="border-t border-slate-100 divide-y divide-slate-50">

                    {/* Actifs */}
                    {actifs.map(d => {
                      const tc = TYPE_CFG[d.type] ?? TYPE_CFG.AVERTISSEMENT
                      const docRH = d.documents.find(doc => doc.type === "DOCUMENT_RH")
                      return (
                        <div key={d.id} className="px-5 py-3.5 flex items-start gap-4">
                          <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                            style={{ background: tc.color + "20", color: tc.color }}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold" style={{ color: tc.color }}>{tc.label}</span>
                              <span className="text-xs text-slate-400">{formatDate(d.date)}</span>
                              {d.sanctionAutoAppliquee && (
                                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Sanction auto</span>
                              )}
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" /> En cours
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 mt-0.5">{d.motif}</p>
                            {d.initiateur && <p className="text-xs text-slate-400">Par {d.initiateur.name}</p>}
                          </div>
                          {docRH && (
                            <a href={`/api/files/${docRH.url}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 flex-shrink-0">
                              <FileText className="h-3.5 w-3.5" />
                              <Download className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )
                    })}

                    {/* Clos */}
                    {clos.map(d => {
                      const tc = TYPE_CFG[d.type] ?? TYPE_CFG.AVERTISSEMENT
                      return (
                        <div key={d.id} className="px-5 py-3 flex items-start gap-4 opacity-50">
                          <CheckCircle className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">{tc.label}</span>
                              <span className="text-xs text-slate-400">{formatDate(d.date)}</span>
                              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Clôturé</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{d.motif}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
