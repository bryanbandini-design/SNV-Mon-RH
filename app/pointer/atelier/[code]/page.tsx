"use client"

import { use, useState, useRef } from "react"
import { CheckCircle2, AlertCircle, Search, Loader2, MapPin } from "lucide-react"

type EmployeResult = { id: string; prenom: string; nom: string; poste: string; matricule: string }
type Done = { prenom: string; nom: string; atelier: string }

export default function PointerAtelierPage({ params }: { params: Promise<{ code: string }> }) {
  const { code }  = use(params)
  const atelierCode = code.toUpperCase()

  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState<EmployeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected,  setSelected]  = useState<EmployeResult | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [done,      setDone]      = useState<Done | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQuery(v: string) {
    setQuery(v); setSelected(null); setError(null)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/search?q=${encodeURIComponent(v)}&type=employe`)
      if (res.ok) { const d = await res.json(); setResults((d.employes ?? []).slice(0, 6)) }
      setSearching(false)
    }, 300)
  }

  async function confirmer() {
    if (!selected) return
    setSaving(true); setError(null)
    const res = await fetch("/api/pointage/confirmer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atelierCode, employeId: selected.id }),
    })
    const d = await res.json()
    if (res.ok) {
      setDone({ prenom: selected.prenom, nom: selected.nom, atelier: d.pointage?.atelier?.nom ?? atelierCode })
      setQuery(""); setResults([]); setSelected(null)
    } else {
      setError(d.error ?? "Erreur lors de l'enregistrement")
    }
    setSaving(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(135deg, #1e1b4b, #4f46e5)" }}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Présence confirmée !</h2>
          <p className="text-slate-600 font-semibold mt-1">{done.prenom} {done.nom}</p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <MapPin className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-semibold text-indigo-600">{done.atelier}</p>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button onClick={() => setDone(null)}
            className="mt-6 w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">
            Nouveau pointage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1e1b4b, #4f46e5)" }}>
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-7 w-7 text-indigo-600" />
          </div>
          <h1 className="text-lg font-black text-slate-900">Pointage — Atelier</h1>
          <p className="text-sm font-mono font-bold text-indigo-600 mt-0.5">{atelierCode}</p>
          <p className="text-xs text-slate-400 mt-1">
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </p>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 border-2 border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-400 transition-colors">
            {searching
              ? <Loader2 className="h-4 w-4 text-slate-400 animate-spin flex-shrink-0" />
              : <Search  className="h-4 w-4 text-slate-400 flex-shrink-0" />
            }
            <input type="text" value={query} onChange={e => handleQuery(e.target.value)}
              placeholder="Nom, prénom ou matricule…"
              className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400"
              autoFocus />
          </div>
          {results.length > 0 && !selected && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden">
              {results.map(e => (
                <button key={e.id}
                  onClick={() => { setSelected(e); setQuery(`${e.prenom} ${e.nom}`); setResults([]) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black flex-shrink-0">
                    {e.prenom[0]}{e.nom[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.prenom} {e.nom}</p>
                    <p className="text-xs text-slate-400">{e.poste} · {e.matricule}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
            <div className="h-9 w-9 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 text-sm font-black flex-shrink-0">
              {selected.prenom[0]}{selected.nom[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{selected.prenom} {selected.nom}</p>
              <p className="text-xs text-indigo-600">{selected.poste} · {selected.matricule}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
          </div>
        )}

        <button onClick={confirmer} disabled={!selected || saving}
          className="mt-4 w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmer ma présence
        </button>
      </div>
    </div>
  )
}
