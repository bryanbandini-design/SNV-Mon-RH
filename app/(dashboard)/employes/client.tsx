"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Users, FlaskConical, Search, ChevronUp, ChevronDown, ChevronsUpDown, FileDown } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { Employe } from "@prisma/client"

function downloadCSV(rows: (string | number | null | undefined)[][], filename: string) {
  const csv  = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

const STATUT_BADGE: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  ACTIF: "success",
  INACTIF: "secondary",
  SUSPENDU: "warning",
}

type SortKey = "nom" | "poste" | "typeContrat" | "dateEmbauche" | "salaireBase" | "statut"
type SortDir = "asc" | "desc"

function badgeEssai(emp: Employe) {
  if (!emp.periodeEssai || !emp.dateFinEssai) return null
  const now = new Date()
  const fin = new Date(emp.dateFinEssai)
  if (now > fin) return <Badge variant="secondary" className="text-xs">Essai terminé</Badge>
  const j = Math.ceil((fin.getTime() - now.getTime()) / 86400000)
  if (j <= 7) return <Badge variant="destructive" className="text-xs gap-1"><FlaskConical className="h-3 w-3" />{j}j</Badge>
  return <Badge variant="warning" className="text-xs gap-1"><FlaskConical className="h-3 w-3" />Essai</Badge>
}

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: SortDir }) {
  if (col !== sortBy) return <ChevronsUpDown className="h-3 w-3 opacity-30 ml-1 inline-block" />
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1 inline-block text-blue-500" />
    : <ChevronDown className="h-3 w-3 ml-1 inline-block text-blue-500" />
}

export function EmployeesClient({ employes }: { employes: Employe[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filtreStatut, setFiltreStatut] = useState<"TOUS" | "ACTIF" | "INACTIF" | "SUSPENDU">("TOUS")
  const [filtreContrat, setFiltreContrat] = useState("TOUS")
  const [filtreDept, setFiltreDept]       = useState("TOUS")
  const [sortBy, setSortBy]   = useState<SortKey>("nom")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const contrats = [...new Set(employes.map(e => e.typeContrat))]
  const depts    = [...new Set(employes.map(e => e.departement).filter(Boolean) as string[])].sort()

  function toggleSort(col: SortKey) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortBy(col); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = employes.filter(e => {
      const matchSearch  = !q || `${e.prenom} ${e.nom} ${e.poste} ${e.matricule} ${e.departement ?? ""}`.toLowerCase().includes(q)
      const matchStatut  = filtreStatut  === "TOUS" || e.statut     === filtreStatut
      const matchContrat = filtreContrat === "TOUS" || e.typeContrat === filtreContrat
      const matchDept    = filtreDept    === "TOUS" || e.departement === filtreDept
      return matchSearch && matchStatut && matchContrat && matchDept
    })

    return [...list].sort((a, b) => {
      let va: string | number = "", vb: string | number = ""
      switch (sortBy) {
        case "nom":          va = `${a.nom} ${a.prenom}`.toLowerCase(); vb = `${b.nom} ${b.prenom}`.toLowerCase(); break
        case "poste":        va = a.poste.toLowerCase();  vb = b.poste.toLowerCase();  break
        case "typeContrat":  va = a.typeContrat;          vb = b.typeContrat;          break
        case "dateEmbauche": va = new Date(a.dateEmbauche).getTime(); vb = new Date(b.dateEmbauche).getTime(); break
        case "salaireBase":  va = a.salaireBase;          vb = b.salaireBase;          break
        case "statut":       va = a.statut;               vb = b.statut;               break
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [employes, search, filtreStatut, filtreContrat, filtreDept, sortBy, sortDir])

  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "nom",          label: "Employé"  },
    { key: "poste",        label: "Poste"    },
    { key: "typeContrat",  label: "Contrat"  },
    { key: "dateEmbauche", label: "Embauche" },
    { key: "salaireBase",  label: "Salaire", align: "right" },
    { key: "statut",       label: "Statut"   },
  ]

  const hasFilter = search || filtreStatut !== "TOUS" || filtreContrat !== "TOUS" || filtreDept !== "TOUS"

  function exportCSV() {
    const header = ["Matricule", "Prénom", "Nom", "Poste", "Département", "Contrat", "Date embauche", "Salaire base", "Statut", "Email", "Téléphone"]
    const rows = filtered.map(e => [
      e.matricule, e.prenom, e.nom, e.poste, e.departement ?? "",
      e.typeContrat, formatDate(e.dateEmbauche), e.salaireBase,
      e.statut, e.email ?? "", e.telephone ?? "",
    ])
    downloadCSV([header, ...rows], `employes_${new Date().toISOString().split("T")[0]}.csv`)
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-start sm:items-center">
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher un employé…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
          {(["TOUS", "ACTIF", "INACTIF", "SUSPENDU"] as const).map(s => (
            <button key={s} onClick={() => setFiltreStatut(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filtreStatut === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {s === "TOUS" ? "Tous" : s}
            </button>
          ))}
        </div>

        {contrats.length > 1 && (
          <select value={filtreContrat} onChange={e => setFiltreContrat(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400">
            <option value="TOUS">Tous contrats</option>
            {contrats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {depts.length > 0 && (
          <select value={filtreDept} onChange={e => setFiltreDept(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400">
            <option value="TOUS">Tous départements</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {hasFilter && (
          <button onClick={() => { setSearch(""); setFiltreStatut("TOUS"); setFiltreContrat("TOUS"); setFiltreDept("TOUS") }}
            className="text-xs text-slate-400 hover:text-slate-600">
            Effacer
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{filtered.length} résultat(s)</p>
        {filtered.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            <FileDown className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun résultat</p>
              {search && <p className="text-sm mt-1">Essayez un autre terme de recherche</p>}
            </div>
          ) : (
            <>
              {/* ── Vue mobile : cartes ──────────────────────────────── */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map(emp => (
                  <div key={emp.id}
                    onClick={() => router.push(`/employes/${emp.id}`)}
                    className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {emp.prenom[0]}{emp.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">{emp.prenom} {emp.nom}</p>
                        <Badge variant={STATUT_BADGE[emp.statut] ?? "secondary"} className="text-[10px]">{emp.statut}</Badge>
                        {badgeEssai(emp)}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {emp.poste}{emp.departement ? ` · ${emp.departement}` : ""}
                      </p>
                      <p className="text-xs text-slate-400">{emp.typeContrat} · {formatDate(emp.dateEmbauche)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(emp.salaireBase)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{emp.matricule}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Vue desktop : tableau ────────────────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {cols.map(col => (
                        <th key={col.key}
                          className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 transition-colors ${col.align === "right" ? "text-right" : "text-left"} ${sortBy === col.key ? "text-blue-600" : "text-slate-500"}`}
                          onClick={() => toggleSort(col.key)}>
                          {col.label}
                          <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />
                        </th>
                      ))}
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((emp) => (
                      <tr key={emp.id}
                        className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/employes/${emp.id}`)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                              {emp.prenom[0]}{emp.nom[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{emp.prenom} {emp.nom}</p>
                              <p className="text-xs text-slate-400">{emp.matricule}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">{emp.poste}</p>
                          {emp.departement && <p className="text-xs text-slate-400">{emp.departement}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{emp.typeContrat}</Badge>
                            {badgeEssai(emp)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(emp.dateEmbauche)}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">{formatCurrency(emp.salaireBase)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={STATUT_BADGE[emp.statut] ?? "secondary"}>{emp.statut}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Voir →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
