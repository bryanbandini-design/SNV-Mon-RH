"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Users, FlaskConical, Search, Filter } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { Employe } from "@prisma/client"

const STATUT_BADGE: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  ACTIF: "success",
  INACTIF: "secondary",
  SUSPENDU: "warning",
}

function badgeEssai(emp: Employe) {
  if (!emp.periodeEssai || !emp.dateFinEssai) return null
  const now = new Date()
  const fin = new Date(emp.dateFinEssai)
  if (now > fin) return <Badge variant="secondary" className="text-xs">Essai terminé</Badge>
  const j = Math.ceil((fin.getTime() - now.getTime()) / 86400000)
  if (j <= 7) return <Badge variant="destructive" className="text-xs gap-1"><FlaskConical className="h-3 w-3" />{j}j</Badge>
  return <Badge variant="warning" className="text-xs gap-1"><FlaskConical className="h-3 w-3" />Essai</Badge>
}

export function EmployeesClient({ employes }: { employes: Employe[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filtreStatut, setFiltreStatut] = useState<"TOUS" | "ACTIF" | "INACTIF" | "SUSPENDU">("TOUS")
  const [filtreContrat, setFiltreContrat] = useState("TOUS")

  const contrats = [...new Set(employes.map(e => e.typeContrat))]

  const filtres = employes.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${e.prenom} ${e.nom} ${e.poste} ${e.matricule} ${e.departement ?? ""}`.toLowerCase().includes(q)
    const matchStatut = filtreStatut === "TOUS" || e.statut === filtreStatut
    const matchContrat = filtreContrat === "TOUS" || e.typeContrat === filtreContrat
    return matchSearch && matchStatut && matchContrat
  })

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
            <button
              key={s}
              onClick={() => setFiltreStatut(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filtreStatut === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {s === "TOUS" ? "Tous" : s}
            </button>
          ))}
        </div>
        {contrats.length > 1 && (
          <select
            value={filtreContrat}
            onChange={e => setFiltreContrat(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="TOUS">Tous contrats</option>
            {contrats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(search || filtreStatut !== "TOUS" || filtreContrat !== "TOUS") && (
          <button
            onClick={() => { setSearch(""); setFiltreStatut("TOUS"); setFiltreContrat("TOUS") }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Résultat */}
      <p className="text-xs text-slate-400">{filtres.length} résultat(s)</p>

      <Card>
        <CardContent className="p-0">
          {filtres.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun résultat</p>
              {search && <p className="text-sm mt-1">Essayez un autre terme de recherche</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employé</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Poste</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contrat</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Embauche</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Salaire</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtres.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/employes/${emp.id}`)}
                    >
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
