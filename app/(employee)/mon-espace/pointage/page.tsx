"use client"

import { useState, useEffect, useCallback } from "react"
import { Clock, CheckCircle2, XCircle, AlertCircle, Plus, LogOut, Pencil, Trash2, Loader2 } from "lucide-react"

type Presence = {
  id: string
  date: string
  heureArrivee: string | null
  heureDepart:  string | null
  heuresTravaillees: number | null
  statut: string
  minutesRetard: number
  statutValidation: string
  notes: string | null
}

const VALIDATION_CFG = {
  EN_ATTENTE: { label: "En attente",  icon: AlertCircle,    cls: "text-amber-600 bg-amber-50  border-amber-200" },
  VALIDEE:    { label: "Validé",      icon: CheckCircle2,   cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  REJETEE:    { label: "Rejeté",      icon: XCircle,        cls: "text-red-600 bg-red-50 border-red-200" },
}

function now(): string {
  return new Date().toTimeString().slice(0, 5)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

export default function MonPointagePage() {
  const [presences, setPresences]   = useState<Presence[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Formulaire arrivée
  const [heureArrivee, setHeureArrivee] = useState(now)
  const [notes, setNotes]               = useState("")

  // Formulaire départ (inline sur la carte du jour)
  const [showDepart, setShowDepart] = useState(false)
  const [heureDepart, setHeureDepart] = useState(now)
  const [departSaving, setDepartSaving] = useState(false)

  // Suppression
  const [deleting, setDeleting] = useState<string | null>(null)

  const today = todayStr()
  const todayPresence = presences.find(p => p.date.startsWith(today))
  const history = presences.filter(p => !p.date.startsWith(today))

  const fetchPresences = useCallback(async () => {
    const res = await fetch("/api/mon-espace/pointage")
    if (res.ok) setPresences(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchPresences() }, [fetchPresences])

  async function submitArrivee(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch("/api/mon-espace/pointage", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ date: today, heureArrivee, notes }),
    })
    if (res.ok) {
      setNotes("")
      await fetchPresences()
    } else {
      const d = await res.json()
      setError(d.message ?? "Erreur lors de l'envoi")
    }
    setSaving(false)
  }

  async function submitDepart() {
    if (!todayPresence) return
    setDepartSaving(true)
    const res = await fetch(`/api/mon-espace/pointage/${todayPresence.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ heureDepart }),
    })
    if (res.ok) { setShowDepart(false); await fetchPresences() }
    setDepartSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce pointage ?")) return
    setDeleting(id)
    await fetch(`/api/mon-espace/pointage/${id}`, { method: "DELETE" })
    await fetchPresences()
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mon pointage</h1>
        <p className="text-sm text-slate-500 mt-1">Enregistrez vos heures d&apos;arrivée et de départ — le responsable les validera</p>
      </div>

      {/* Carte du jour */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-500" />
          <p className="font-semibold text-slate-900 text-sm">
            Aujourd&apos;hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {todayPresence ? (
          <div className="p-5 space-y-4">
            {/* Statut validation */}
            {(() => {
              const cfg = VALIDATION_CFG[todayPresence.statutValidation as keyof typeof VALIDATION_CFG] ?? VALIDATION_CFG.EN_ATTENTE
              const Icon = cfg.icon
              return (
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${cfg.cls}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </div>
              )
            })()}

            {/* Heures */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                <p className="text-xs text-emerald-600 font-medium mb-1">Arrivée</p>
                <p className="text-2xl font-black text-emerald-700 font-mono">{todayPresence.heureArrivee}</p>
              </div>
              <div className={`rounded-xl border p-4 text-center ${todayPresence.heureDepart ? "bg-slate-50 border-slate-100" : "bg-slate-50/50 border-dashed border-slate-200"}`}>
                <p className="text-xs text-slate-500 font-medium mb-1">Départ</p>
                {todayPresence.heureDepart
                  ? <p className="text-2xl font-black text-slate-700 font-mono">{todayPresence.heureDepart}</p>
                  : <p className="text-sm text-slate-400 italic mt-1">Non enregistré</p>
                }
              </div>
            </div>

            {todayPresence.notes && (
              <p className="text-xs text-slate-500 italic bg-slate-50 rounded-lg px-3 py-2">{todayPresence.notes}</p>
            )}

            {/* Actions */}
            {todayPresence.statutValidation !== "VALIDEE" && (
              <div className="flex items-center gap-2 flex-wrap">
                {!todayPresence.heureDepart && !showDepart && (
                  <button onClick={() => { setHeureDepart(now()); setShowDepart(true) }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">
                    <LogOut className="h-4 w-4" />
                    Enregistrer mon départ
                  </button>
                )}
                <button onClick={() => handleDelete(todayPresence.id)} disabled={deleting === todayPresence.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
                  {deleting === todayPresence.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Supprimer
                </button>
              </div>
            )}

            {/* Formulaire départ inline */}
            {showDepart && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <LogOut className="h-4 w-4 text-slate-500" /> Heure de départ
                </p>
                <input type="time" value={heureDepart} onChange={e => setHeureDepart(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-lg text-center" />
                <div className="flex gap-2">
                  <button onClick={submitDepart} disabled={departSaving}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {departSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmer
                  </button>
                  <button onClick={() => setShowDepart(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Formulaire arrivée */
          <form onSubmit={submitArrivee} className="p-5 space-y-4">
            <p className="text-sm text-slate-500">Vous n&apos;avez pas encore pointé aujourd&apos;hui.</p>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Heure d&apos;arrivée</label>
              <input type="time" value={heureArrivee} onChange={e => setHeureArrivee(e.target.value)} required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xl font-mono font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Note <span className="font-normal text-slate-400">(facultatif)</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ex : arrivée tardive, raison..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={saving}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Pointer mon arrivée
            </button>
          </form>
        )}
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">Historique — 30 derniers jours</p>
          </div>
          <div className="divide-y divide-slate-50">
            {history.map(p => {
              const cfg = VALIDATION_CFG[p.statutValidation as keyof typeof VALIDATION_CFG] ?? VALIDATION_CFG.EN_ATTENTE
              const Icon = cfg.icon
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 capitalize">{fmtDate(p.date)}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {p.heureArrivee ?? "--:--"} → {p.heureDepart ?? "--:--"}
                      {p.heuresTravaillees != null && p.heuresTravaillees > 0 && (
                        <span className="text-slate-400"> · {Math.floor(p.heuresTravaillees)}h{Math.round((p.heuresTravaillees % 1) * 60).toString().padStart(2,"0")}</span>
                      )}
                    </p>
                    {p.statut === "RETARD" && p.minutesRetard > 0 && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5">Retard : {p.minutesRetard} min</p>
                    )}
                    {p.notes && <p className="text-xs text-slate-400 italic mt-0.5 truncate">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {p.statut === "RETARD" && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Retard</span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    {p.statutValidation === "EN_ATTENTE" && (
                      <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        {deleting === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {history.length === 0 && !todayPresence && (
        <div className="text-center py-10 text-slate-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucun pointage enregistré</p>
        </div>
      )}
    </div>
  )
}
