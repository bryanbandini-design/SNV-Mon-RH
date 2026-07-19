"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Loader2, GitBranch, Users, ZoomIn, ZoomOut, Maximize2,
  Search, X, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react"
import Link from "next/link"

type Employe = {
  id: string; prenom: string; nom: string; poste: string
  departement: string | null; statut: string; managerId: string | null
  salaireBase: number; roleOrg: string
}
type TreeNode = Employe & { reports: TreeNode[] }

function buildTree(employes: Employe[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  for (const e of employes) map.set(e.id, { ...e, reports: [] })
  const roots: TreeNode[] = []
  for (const e of employes) {
    const node = map.get(e.id)!
    if (e.managerId && map.has(e.managerId)) map.get(e.managerId)!.reports.push(node)
    else roots.push(node)
  }
  return roots
}

// Couleur par département
const DEPT_PALETTE: [string, string][] = [
  ["direction",    "#1a3461"],
  ["rh",           "#7c3aed"],
  ["ressources",   "#7c3aed"],
  ["informatique", "#2563eb"],
  ["tech",         "#2563eb"],
  ["commercial",   "#d97706"],
  ["vente",        "#d97706"],
  ["finance",      "#059669"],
  ["compta",       "#059669"],
  ["production",   "#dc2626"],
  ["lavage",       "#0891b2"],
  ["logistique",   "#0891b2"],
  ["marketing",    "#db2777"],
]
function deptColor(dept: string | null): string {
  if (!dept) return "#64748b"
  const low = dept.toLowerCase()
  const found = DEPT_PALETTE.find(([k]) => low.includes(k))
  return found ? found[1] : "#64748b"
}

// Badge rôle
const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN:       { label: "Admin",       bg: "#1e293b", color: "#f1f5f9" },
  RH:          { label: "RH",          bg: "#7c3aed", color: "#ffffff" },
  RESPONSABLE: { label: "Responsable", bg: "#d97706", color: "#ffffff" },
}

// ── Nœud ────────────────────────────────────────────────────────────────────
function NodeCard({
  node, depth = 0, search, forceExpand,
}: {
  node: TreeNode; depth?: number; search: string; forceExpand: boolean | null
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const color    = deptColor(node.departement)
  const hasKids  = node.reports.length > 0
  const roleBadge = ROLE_BADGE[node.roleOrg]
  const highlight = search.length > 1 && (
    `${node.prenom} ${node.nom}`.toLowerCase().includes(search.toLowerCase()) ||
    (node.poste ?? "").toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (forceExpand === true)  setExpanded(true)
    if (forceExpand === false) setExpanded(false)
  }, [forceExpand])

  return (
    <div className="flex flex-col items-center select-none">
      {/* ── Card ── */}
      <div className={`relative rounded-2xl bg-white transition-all duration-200
        ${highlight ? "ring-2 ring-offset-2" : "ring-1 ring-slate-200"}
        hover:shadow-lg hover:-translate-y-0.5 group`}
        style={{
          minWidth: 168, maxWidth: 168,
          boxShadow: highlight
            ? `0 0 0 2px ${color}, 0 4px 12px ${color}30`
            : "0 0 0 1px #e2e8f0",
        }}>

        {/* Bande couleur top */}
        <div className="h-2 rounded-t-2xl" style={{ backgroundColor: color }} />

        {/* Corps */}
        <div className="px-3 pt-3 pb-2">
          {/* Avatar */}
          <div className="relative mx-auto mb-2.5" style={{ width: 44, height: 44 }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ backgroundColor: color }}>
              {node.prenom[0]}{node.nom[0]}
            </div>
            {roleBadge && (
              <span className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none"
                style={{ background: roleBadge.bg, color: roleBadge.color }}>
                {roleBadge.label}
              </span>
            )}
          </div>

          {/* Nom */}
          <p className="text-xs font-bold text-slate-900 text-center leading-tight truncate">
            {node.prenom} {node.nom}
          </p>

          {/* Poste */}
          <p className="text-[10px] text-slate-500 text-center truncate mt-0.5 leading-tight">
            {node.poste}
          </p>

          {/* Département */}
          {node.departement && (
            <div className="mt-1.5 flex justify-center">
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: color + "18", color }}>
                {node.departement}
              </span>
            </div>
          )}
        </div>

        {/* Pied : rapports directs + lien fiche */}
        <div className="border-t border-slate-100 px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {hasKids ? `${node.reports.length} rapport${node.reports.length > 1 ? "s" : ""}` : "—"}
          </span>
          <Link href={`/employes/${node.id}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700">
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── Bouton expand / collapse ── */}
      {hasKids && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1 z-10 h-5 w-5 rounded-full bg-white border flex items-center justify-center
            shadow-sm hover:shadow-md transition-all hover:scale-110"
          style={{ borderColor: color }}>
          {expanded
            ? <ChevronUp   className="h-3 w-3" style={{ color }} />
            : <ChevronDown className="h-3 w-3" style={{ color }} />}
        </button>
      )}

      {/* ── Enfants ── */}
      {hasKids && expanded && (
        <div className="flex flex-col items-center">
          {/* Stem */}
          <div className="w-px" style={{ height: 16, backgroundColor: color + "60" }} />

          {node.reports.length === 1 ? (
            <NodeCard node={node.reports[0]} depth={depth + 1} search={search} forceExpand={forceExpand} />
          ) : (
            /* Rail + twigs */
            <div
              className="flex items-start border-t"
              style={{ borderColor: color + "50", borderTopWidth: 1.5 }}>
              {node.reports.map(child => (
                <div key={child.id} className="flex flex-col items-center px-5">
                  <div className="w-px" style={{ height: 16, backgroundColor: color + "60" }} />
                  <NodeCard node={child} depth={depth + 1} search={search} forceExpand={forceExpand} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function OrganigrammePage() {
  const [employes,    setEmployes]    = useState<Employe[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tree,        setTree]        = useState<TreeNode[]>([])
  const [search,      setSearch]      = useState("")
  const [deptFilter,  setDeptFilter]  = useState<string>("TOUS")
  const [forceExpand, setForceExpand] = useState<boolean | null>(null)

  // Zoom & Pan
  const [zoom, setZoom] = useState(0.9)
  const [pos,  setPos]  = useState({ x: 0, y: 0 })
  const dragging  = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/employes").then(r => r.json()).then((data: Employe[]) => {
      const actifs = Array.isArray(data) ? data.filter(e => e.statut === "ACTIF") : []
      setEmployes(actifs)
      setTree(buildTree(actifs))
      setLoading(false)
    })
  }, [])

  // Zoom avec la molette
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(2.5, z - e.deltaY * 0.001)))
  }, [])
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [onWheel])

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    dragging.current  = true
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }
  function onMouseUp() { dragging.current = false }

  function resetView() { setZoom(0.9); setPos({ x: 0, y: 0 }) }

  // Filtrage par département
  const depts = ["TOUS", ...new Set(employes.map(e => e.departement).filter(Boolean) as string[])].sort()

  const filteredTree: TreeNode[] = deptFilter === "TOUS"
    ? tree
    : tree.map(root => filterTree(root, deptFilter)).filter(Boolean) as TreeNode[]

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )

  const depth  = treeDepth(tree)
  const total  = employes.length

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organigramme</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} employé(s) · {depth} niveau(x) hiérarchique(s)
          </p>
        </div>
        <Link href="/employes"
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white
            text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
          <Users className="h-4 w-4" /> Liste
        </Link>
      </div>

      {/* ── Barre d'outils ── */}
      <div className="flex flex-wrap items-center gap-2 pb-3 px-1">
        {/* Recherche */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un employé…"
            className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-slate-200 bg-white
              focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtre département */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300">
          {depts.map(d => <option key={d} value={d}>{d === "TOUS" ? "Tous les départements" : d}</option>)}
        </select>

        {/* Expand / Collapse */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setForceExpand(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
            <ChevronDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={() => setForceExpand(false)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
            <ChevronUp className="h-3.5 w-3.5" /> Tout replier
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-mono text-slate-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button onClick={resetView}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" title="Réinitialiser la vue">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Légende ── */}
      <div className="flex flex-wrap gap-2 pb-3 px-1">
        {Object.entries(ROLE_BADGE).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{ background: v.bg + "18", color: v.bg }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.bg }} />
            {v.label}
          </div>
        ))}
        {employes.some(e => !e.roleOrg || e.roleOrg === "EMPLOYE") && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Employé
          </div>
        )}
        {[...new Set(employes.map(e => e.departement).filter(Boolean) as string[])].slice(0, 6).map(d => (
          <div key={d} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: deptColor(d) }} />
            {d}
          </div>
        ))}
      </div>

      {/* ── Canvas ── */}
      {filteredTree.length === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
          <div className="text-center">
            <GitBranch className="h-12 w-12 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-500">Aucun résultat</p>
            <p className="text-sm text-slate-400 mt-1">
              {search ? `Aucun employé pour "${search}"` : "Assignez un manager à chaque employé pour construire la hiérarchie."}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-white"
          style={{
            backgroundSize: "24px 24px",
            cursor: dragging.current ? "grabbing" : "grab",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}>
          <div
            className="inline-flex flex-col items-center p-16"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
              transformOrigin: "top center",
              willChange: "transform",
            }}>
            <div className="flex items-start gap-16">
              {filteredTree.map(root => (
                <NodeCard
                  key={root.id}
                  node={root}
                  search={search}
                  forceExpand={forceExpand}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pt-2">
        Molette pour zoomer · Cliquer-glisser pour naviguer · Cliquez sur une carte pour voir la fiche
      </p>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function treeDepth(nodes: TreeNode[]): number {
  if (!nodes.length) return 0
  return 1 + Math.max(...nodes.map(n => treeDepth(n.reports)))
}

function filterTree(node: TreeNode, dept: string): TreeNode | null {
  const filteredReports = node.reports.map(c => filterTree(c, dept)).filter(Boolean) as TreeNode[]
  if (node.departement === dept || filteredReports.length > 0) {
    return { ...node, reports: filteredReports }
  }
  return null
}
