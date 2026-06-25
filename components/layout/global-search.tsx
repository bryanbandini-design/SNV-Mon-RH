"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, User } from "lucide-react"

type Result = { id: string; prenom: string; nom: string; matricule: string; poste: string; departement: string | null }

export function GlobalSearch() {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const router    = useRouter()

  // Keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50) }
    else { setQuery(""); setResults([]) }
  }, [open])

  const search = useCallback((q: string) => {
    clearTimeout(timerRef.current)
    if (q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setSelected(0)
      } finally { setLoading(false) }
    }, 220)
  }, [])

  function navigate(id: string) {
    router.push(`/employes/${id}`)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].id)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 text-sm hover:border-slate-300 hover:text-slate-600 transition-colors"
        style={{ background: "rgba(248,250,252,0.8)", minWidth: 160 }}
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-xs">Rechercher…</span>
        <kbd className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1 py-px font-mono">⌘K</kbd>
      </button>

      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); search(e.target.value) }}
                onKeyDown={onKeyDown}
                placeholder="Nom, matricule, poste…"
                className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              {loading && (
                <div className="h-4 w-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results */}
            {results.length > 0 ? (
              <div className="py-1.5 max-h-72 overflow-y-auto">
                {results.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(r.id)}
                    onMouseEnter={() => setSelected(i)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ background: i === selected ? "#f1f5f9" : "transparent" }}
                  >
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)" }}>
                      {r.prenom[0]}{r.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{r.prenom} {r.nom}</p>
                      <p className="text-xs text-slate-400 truncate">{r.poste}{r.departement ? ` · ${r.departement}` : ""}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-400 flex-shrink-0">{r.matricule}</span>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 && !loading ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                <User className="h-8 w-8 opacity-20" />
                <p className="text-sm">Aucun employé trouvé</p>
              </div>
            ) : query.length < 2 ? (
              <div className="px-4 py-5 text-xs text-slate-400 space-y-1">
                <p className="font-medium text-slate-500 mb-2">Recherche rapide</p>
                <p>· Tapez un <span className="text-slate-600 font-medium">nom</span> ou <span className="text-slate-600 font-medium">matricule</span></p>
                <p>· Utilisez <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono">↑↓</kbd> pour naviguer, <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono">↵</kbd> pour ouvrir</p>
                <p>· <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono">Esc</kbd> pour fermer</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
