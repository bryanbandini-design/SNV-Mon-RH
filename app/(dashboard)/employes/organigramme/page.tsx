"use client"

import { useState, useEffect, useRef, useCallback, useMemo, type ReactElement } from "react"
import {
  Loader2, GitBranch, Users, ZoomIn, ZoomOut,
  Maximize2, Search, X, ChevronDown, ChevronUp,
} from "lucide-react"
import Link from "next/link"

// ── Types ───────────────────────────────────────────────────────────────────
type Employe  = {
  id: string; prenom: string; nom: string; poste: string
  departement: string | null; statut: string; managerId: string | null
  salaireBase: number; roleOrg: string
}
type TreeNode  = Employe & { reports: TreeNode[] }
type LayoutPos = { x: number; y: number }

// ── Constantes layout ───────────────────────────────────────────────────────
const NODE_W  = 168   // largeur d'une carte
const NODE_H  = 155   // hauteur d'une carte (incl. footer)
const BTN_H   = 22    // hauteur du bouton expand sous la carte
const H_GAP   = 44    // espace horizontal entre sous-arbres frères
const V_GAP   = 60    // espace vertical entre niveaux

// ── Couleurs ────────────────────────────────────────────────────────────────
const DEPT_PALETTE: [string, string][] = [
  ["direction",    "#1a3461"],
  ["rh",           "#7c3aed"],
  ["ressources",   "#7c3aed"],
  ["informatique", "#2563eb"],
  ["commercial",   "#d97706"],
  ["finance",      "#059669"],
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

const ROLE_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  ADMIN:       { label: "Admin",  bg: "#1e293b", fg: "#f1f5f9" },
  RH:          { label: "RH",    bg: "#7c3aed", fg: "#ffffff" },
  RESPONSABLE: { label: "Resp.", bg: "#d97706", fg: "#ffffff" },
}

// ── Arbre ───────────────────────────────────────────────────────────────────
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

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap(n => [n, ...flatten(n.reports)])
}

function filterTree(node: TreeNode, dept: string): TreeNode | null {
  const fr = node.reports.map(c => filterTree(c, dept)).filter(Boolean) as TreeNode[]
  return (node.departement === dept || fr.length > 0) ? { ...node, reports: fr } : null
}

// ── Algorithme de layout ─────────────────────────────────────────────────────
// Largeur totale du sous-arbre d'un nœud (tenant compte de l'état expand)
function subtreeW(node: TreeNode, exp: Set<string>): number {
  if (!node.reports.length || !exp.has(node.id)) return NODE_W + H_GAP
  return node.reports.reduce((s, c) => s + subtreeW(c, exp), 0)
}

// Calcule les positions absolues de chaque nœud
function computeLayout(
  node: TreeNode, x: number, y: number,
  exp: Set<string>, pos: Map<string, LayoutPos>
) {
  const sw = subtreeW(node, exp)
  // Centre le nœud au-dessus de son sous-arbre
  pos.set(node.id, { x: x + sw / 2 - NODE_W / 2, y })
  if (!exp.has(node.id) || !node.reports.length) return
  let cx = x
  for (const child of node.reports) {
    computeLayout(child, cx, y + NODE_H + BTN_H + V_GAP, exp, pos)
    cx += subtreeW(child, exp)
  }
}

// Init : tout déplié
function initExpanded(nodes: TreeNode[], set = new Set<string>()): Set<string> {
  for (const n of nodes) { set.add(n.id); initExpanded(n.reports, set) }
  return set
}

// ── SVG Connecteurs ──────────────────────────────────────────────────────────
function SvgConnectors({
  roots, pos, exp, colorOf,
}: {
  roots: TreeNode[]
  pos: Map<string, LayoutPos>
  exp: Set<string>
  colorOf: (id: string) => string
}) {
  const lines: ReactElement[] = []

  function draw(node: TreeNode) {
    if (!exp.has(node.id) || !node.reports.length) return
    const p   = pos.get(node.id)
    if (!p) return

    const pCx    = p.x + NODE_W / 2
    const pBotY  = p.y + NODE_H + BTN_H          // bas du bouton expand
    const midY   = pBotY + V_GAP / 2             // niveau du rail horizontal
    const col    = colorOf(node.id)

    if (node.reports.length === 1) {
      const cp = pos.get(node.reports[0].id)
      if (!cp) return
      const cCx = cp.x + NODE_W / 2
      lines.push(
        <path key={`${node.id}-s`}
          d={`M ${pCx} ${pBotY} V ${midY} H ${cCx} V ${cp.y}`}
          stroke={col} strokeWidth={1.5} strokeOpacity={0.45}
          fill="none" strokeLinejoin="round" />
      )
    } else {
      const first = pos.get(node.reports[0].id)
      const last  = pos.get(node.reports[node.reports.length - 1].id)
      if (!first || !last) return

      const railL = first.x + NODE_W / 2
      const railR = last.x  + NODE_W / 2

      // Tige verticale depuis parent
      lines.push(<line key={`${node.id}-stem`}
        x1={pCx} y1={pBotY} x2={pCx} y2={midY}
        stroke={col} strokeWidth={1.5} strokeOpacity={0.45} />)

      // Rail horizontal
      lines.push(<line key={`${node.id}-rail`}
        x1={railL} y1={midY} x2={railR} y2={midY}
        stroke={col} strokeWidth={1.5} strokeOpacity={0.45} />)

      // Branches verticales vers chaque enfant
      for (const child of node.reports) {
        const cp = pos.get(child.id)
        if (!cp) continue
        lines.push(<line key={`${node.id}-${child.id}`}
          x1={cp.x + NODE_W / 2} y1={midY}
          x2={cp.x + NODE_W / 2} y2={cp.y}
          stroke={col} strokeWidth={1.5} strokeOpacity={0.45} />)
        draw(child)
      }
      return
    }
    for (const child of node.reports) draw(child)
  }

  for (const root of roots) draw(root)
  return <>{lines}</>
}

// ── Carte nœud ──────────────────────────────────────────────────────────────
function NodeCard({
  node, pos, color, roleBadge, isExpanded, onToggle, search, hasChildren,
}: {
  node: TreeNode; pos: LayoutPos; color: string
  roleBadge?: { label: string; bg: string; fg: string }
  isExpanded: boolean; onToggle: () => void
  search: string; hasChildren: boolean
}) {
  const highlight = search.length > 1 && (
    `${node.prenom} ${node.nom}`.toLowerCase().includes(search.toLowerCase()) ||
    (node.poste ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position: "absolute", left: pos.x, top: pos.y, width: NODE_W }}>
      {/* Carte */}
      <Link href={`/employes/${node.id}`} className="block group" style={{ textDecoration: "none" }}>
        <div
          className="rounded-2xl bg-white transition-all duration-150 hover:shadow-xl hover:-translate-y-0.5"
          style={{
            boxShadow: highlight
              ? `0 0 0 2.5px ${color}, 0 8px 24px ${color}30`
              : "0 1px 3px #0001, 0 0 0 1px #e2e8f0",
          }}>
          {/* Bandeau couleur */}
          <div className="h-1.5 rounded-t-2xl" style={{ background: color }} />

          <div className="px-3 pt-3 pb-2 text-center">
            {/* Avatar */}
            <div className="relative inline-block mb-2">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow"
                style={{ background: color }}>
                {node.prenom[0]}{node.nom[0]}
              </div>
              {roleBadge && (
                <span
                  className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm leading-none"
                  style={{ background: roleBadge.bg, color: roleBadge.fg }}>
                  {roleBadge.label}
                </span>
              )}
            </div>

            {/* Nom */}
            <p className="text-[11px] font-bold text-slate-900 leading-tight truncate">
              {node.prenom} {node.nom}
            </p>

            {/* Poste */}
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{node.poste}</p>

            {/* Département */}
            {node.departement && (
              <div className="mt-1.5 flex justify-center">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: color + "18", color }}>
                  {node.departement}
                </span>
              </div>
            )}
          </div>

          {/* Footer rapports */}
          {hasChildren && (
            <div className="border-t border-slate-100 px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400">
                {node.reports.length} rapport{node.reports.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Bouton expand / collapse */}
      {hasChildren && (
        <div className="flex justify-center mt-1">
          <button
            onClick={e => { e.preventDefault(); onToggle() }}
            className="h-5 w-5 rounded-full bg-white border flex items-center justify-center
              shadow-sm hover:shadow-md transition-all hover:scale-110"
            style={{ borderColor: color, borderWidth: 1.5 }}>
            {isExpanded
              ? <ChevronUp   className="h-2.5 w-2.5" style={{ color }} />
              : <ChevronDown className="h-2.5 w-2.5" style={{ color }} />}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function OrganigrammePage() {
  const [employes,   setEmployes]   = useState<Employe[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tree,       setTree]       = useState<TreeNode[]>([])
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const [search,     setSearch]     = useState("")
  const [deptFilter, setDeptFilter] = useState("TOUS")
  const [zoom, setZoom] = useState(0.85)
  const [pan,  setPan]  = useState({ x: 0, y: 0 })

  const dragging  = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/employes").then(r => r.json()).then((data: Employe[]) => {
      const actifs = Array.isArray(data) ? data.filter(e => e.statut === "ACTIF") : []
      setEmployes(actifs)
      const t = buildTree(actifs)
      setTree(t)
      setExpanded(initExpanded(t))
      setLoading(false)
    })
  }, [])

  // Zoom molette
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.2, Math.min(2.5, z - e.deltaY * 0.001)))
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
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }
  function onMouseUp() { dragging.current = false }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Arbre filtré par département
  const filteredTree = useMemo(() =>
    deptFilter === "TOUS" ? tree
      : tree.map(r => filterTree(r, deptFilter)).filter(Boolean) as TreeNode[],
    [tree, deptFilter]
  )

  const allNodes = useMemo(() => flatten(filteredTree), [filteredTree])

  // Layout : positions absolues
  const positions = useMemo(() => {
    const map = new Map<string, LayoutPos>()
    let x = H_GAP / 2
    for (const root of filteredTree) {
      computeLayout(root, x, 0, expanded, map)
      x += subtreeW(root, expanded)
    }
    return map
  }, [filteredTree, expanded])

  // Dimensions totales du canvas
  const canvasDims = useMemo(() => {
    let maxX = 0, maxY = 0
    for (const [, p] of positions) {
      maxX = Math.max(maxX, p.x + NODE_W + H_GAP / 2)
      maxY = Math.max(maxY, p.y + NODE_H + BTN_H + V_GAP)
    }
    return { width: Math.max(maxX, 600), height: Math.max(maxY, 300) }
  }, [positions])

  // Lookup couleur par id
  const colorById = useCallback((id: string) => {
    const node = allNodes.find(n => n.id === id)
    return deptColor(node?.departement ?? null)
  }, [allNodes])

  const depts = useMemo(() =>
    ["TOUS", ...new Set(employes.map(e => e.departement).filter(Boolean) as string[])].sort(),
    [employes]
  )

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organigramme</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {employes.length} employé(s) actif(s)
          </p>
        </div>
        <Link href="/employes"
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200
            bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
          <Users className="h-4 w-4" /> Liste
        </Link>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {/* Recherche */}
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
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
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-indigo-200">
          {depts.map(d => (
            <option key={d} value={d}>{d === "TOUS" ? "Tous les départements" : d}</option>
          ))}
        </select>

        {/* Expand / Collapse */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setExpanded(new Set(allNodes.map(n => n.id)))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
            <ChevronDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button
            onClick={() => setExpanded(new Set(filteredTree.map(r => r.id)))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
            <ChevronUp className="h-3.5 w-3.5" /> Tout replier
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-mono text-slate-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button
            onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }) }}
            title="Réinitialiser la vue"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Légende rôles */}
      <div className="flex flex-wrap gap-2 pb-3">
        {Object.entries(ROLE_BADGE).map(([, v]) => (
          <span key={v.label}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: v.bg + "18", color: v.bg }}>
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: v.bg }} />
            {v.label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      {filteredTree.length === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
          <div className="text-center">
            <GitBranch className="h-12 w-12 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-500">Aucun résultat</p>
            <p className="text-sm text-slate-400 mt-1">
              {search ? `Aucun employé pour « ${search} »` : "Assignez un manager à chaque employé pour construire la hiérarchie."}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize:  "24px 24px",
            cursor: dragging.current ? "grabbing" : "grab",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div style={{
            transform:       `translate(${pan.x + 48}px, ${pan.y + 48}px) scale(${zoom})`,
            transformOrigin: "top left",
            willChange:      "transform",
            position:        "relative",
            width:           canvasDims.width,
            height:          canvasDims.height,
          }}>
            {/* Connecteurs SVG */}
            <svg
              style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
              width={canvasDims.width}
              height={canvasDims.height}
            >
              <SvgConnectors
                roots={filteredTree}
                pos={positions}
                exp={expanded}
                colorOf={colorById}
              />
            </svg>

            {/* Cartes */}
            {allNodes.map(node => {
              const p = positions.get(node.id)
              if (!p) return null
              return (
                <NodeCard
                  key={node.id}
                  node={node}
                  pos={p}
                  color={deptColor(node.departement)}
                  roleBadge={ROLE_BADGE[node.roleOrg]}
                  isExpanded={expanded.has(node.id)}
                  onToggle={() => toggle(node.id)}
                  search={search}
                  hasChildren={node.reports.length > 0}
                />
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pt-2">
        Molette pour zoomer · Cliquer-glisser pour naviguer · Clic sur une carte pour voir la fiche
      </p>
    </div>
  )
}
