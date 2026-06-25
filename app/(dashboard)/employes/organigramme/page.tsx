"use client"

import { useState, useEffect } from "react"
import { Loader2, GitBranch, Users } from "lucide-react"
import Link from "next/link"

type Employe = {
  id: string; prenom: string; nom: string; poste: string
  departement: string | null; statut: string; managerId: string | null; salaireBase: number
}

type TreeNode = Employe & { reports: TreeNode[] }

function buildTree(employes: Employe[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  for (const e of employes) map.set(e.id, { ...e, reports: [] })
  const roots: TreeNode[] = []
  for (const e of employes) {
    const node = map.get(e.id)!
    if (e.managerId && map.has(e.managerId)) {
      map.get(e.managerId)!.reports.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

const DEPT_COLORS: Record<string, string> = {
  "Direction":       "#1e293b",
  "RH":              "#7c3aed",
  "Informatique":    "#2563eb",
  "Commercial":      "#d97706",
  "Finance":         "#059669",
  "Production":      "#dc2626",
  "Marketing":       "#db2777",
  "Logistique":      "#0891b2",
}

function getColor(dept: string | null): string {
  if (!dept) return "#64748b"
  const found = Object.entries(DEPT_COLORS).find(([k]) => dept.toLowerCase().includes(k.toLowerCase()))
  return found ? found[1] : "#64748b"
}

function NodeCard({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true)
  const color = getColor(node.departement)
  const hasReports = node.reports.length > 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Link href={`/employes/${node.id}`}>
          <div className="rounded-xl border-2 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group"
            style={{ borderColor: color, minWidth: "140px", maxWidth: "160px" }}>
            <div className="h-1.5 rounded-t-lg" style={{ backgroundColor: color }} />
            <div className="p-3 text-center">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-2"
                style={{ backgroundColor: color }}>
                {node.prenom[0]}{node.nom[0]}
              </div>
              <p className="text-xs font-bold text-slate-900 leading-tight truncate">{node.prenom} {node.nom}</p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{node.poste}</p>
              {node.departement && <p className="text-[10px] font-medium mt-1" style={{ color }}>{node.departement}</p>}
            </div>
            {hasReports && (
              <div className="border-t border-slate-100 px-3 py-1.5 text-center">
                <p className="text-[10px] text-slate-400">{node.reports.length} rapport(s)</p>
              </div>
            )}
          </div>
        </Link>
        {hasReports && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white border-2 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-all z-10 shadow-sm"
            style={{ borderColor: color }}>
            <span className="text-xs font-bold" style={{ color }}>{expanded ? "−" : "+"}</span>
          </button>
        )}
      </div>

      {hasReports && expanded && (
        <div className="flex flex-col items-center mt-6">
          <div className="w-0.5 h-4" style={{ backgroundColor: color + "60" }} />
          <div className="flex items-start gap-4">
            {node.reports.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                {node.reports.length > 1 && (
                  <div className="h-0.5 w-full" style={{ backgroundColor: color + "40", marginBottom: "0" }} />
                )}
                <NodeCard node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrganigrammePage() {
  const [employes, setEmployes] = useState<Employe[]>([])
  const [loading, setLoading]  = useState(true)
  const [tree, setTree]        = useState<TreeNode[]>([])

  useEffect(() => {
    fetch("/api/employes").then(r => r.json()).then((data: Employe[]) => {
      const actifs = Array.isArray(data) ? data.filter(e => e.statut === "ACTIF") : []
      setEmployes(actifs)
      setTree(buildTree(actifs))
      setLoading(false)
    })
  }, [])

  const depts = [...new Set(employes.map(e => e.departement).filter(Boolean) as string[])].sort()

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organigramme</h1>
          <p className="text-sm text-slate-500 mt-1">{employes.length} employé(s) actif(s) · Structure hiérarchique</p>
        </div>
        <Link href="/employes" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
          <Users className="h-4 w-4" /> Liste employés
        </Link>
      </div>

      {/* Légende départements */}
      {depts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {depts.map(d => (
            <div key={d} className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(d) }} />
              {d}
            </div>
          ))}
        </div>
      )}

      {tree.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <GitBranch className="h-12 w-12 mx-auto mb-4 text-slate-200" />
          <p className="font-semibold text-slate-500">Aucun organigramme disponible</p>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
            Assignez un manager à chaque employé depuis sa fiche pour construire la hiérarchie.
          </p>
          <Link href="/employes" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
            <Users className="h-4 w-4" /> Gérer les employés
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-auto p-8">
          <div className="flex flex-col items-center gap-6 min-w-max mx-auto">
            {tree.map(root => (
              <NodeCard key={root.id} node={root} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Pour modifier la hiérarchie, éditez le champ &ldquo;Manager&rdquo; dans la fiche de chaque employé.
      </p>
    </div>
  )
}
