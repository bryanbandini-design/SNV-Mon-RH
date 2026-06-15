"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, Calendar, CheckCircle, XCircle, AlertCircle, Loader2, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TYPES_CONGE } from "@/lib/utils"

type Conge = {
  id: string; type: string; dateDebut: string; dateFin: string
  nbJours: number; motif: string | null; statut: string; commentaire: string | null
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  APPROUVE:   { label: "Approuvé",   color: "#10b981", bg: "#ecfdf5", icon: CheckCircle },
  REFUSE:     { label: "Refusé",     color: "#ef4444", bg: "#fef2f2", icon: XCircle     },
  EN_ATTENTE: { label: "En attente", color: "#f59e0b", bg: "#fffbeb", icon: AlertCircle  },
}

function formatDateFr(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

export default function MesCongesPage() {
  const [conges, setConges]   = useState<Conge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", motif: "" })
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/mon-espace/conges")
      .then(r => r.json())
      .then(d => { setConges(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const nbJoursPrev = form.dateDebut && form.dateFin
    ? Math.max(0, Math.ceil((new Date(form.dateFin).getTime() - new Date(form.dateDebut).getTime()) / 86400000) + 1)
    : 0

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!form.type || !form.dateDebut || !form.dateFin) return
    setSaving(true)
    const res = await fetch("/api/mon-espace/conges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const c = await res.json()
      setConges(prev => [c, ...prev])
      setForm({ type: "", dateDebut: "", dateFin: "", motif: "" })
      setShowForm(false)
      toast.success("Demande soumise — en attente de validation RH")
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.message ?? "Erreur lors de la soumission")
    }
    setSaving(false)
  }

  async function annulerDemande(id: string) {
    if (!confirm("Annuler cette demande de congé ?")) return
    setCancellingId(id)
    const res = await fetch(`/api/conges/${id}`, { method: "DELETE" })
    if (res.ok) {
      setConges(prev => prev.filter(c => c.id !== id))
      toast.success("Demande annulée")
    } else { toast.error("Erreur lors de l'annulation") }
    setCancellingId(null)
  }

  const stats = {
    total:     conges.length,
    approuves: conges.filter(c => c.statut === "APPROUVE").length,
    attente:   conges.filter(c => c.statut === "EN_ATTENTE").length,
    refuses:   conges.filter(c => c.statut === "REFUSE").length,
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes congés</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez vos demandes de congé</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
          <Plus className="h-4 w-4" />
          Nouvelle demande
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",     value: stats.total,     color: "text-slate-900"   },
          { label: "Approuvés", value: stats.approuves, color: "text-emerald-700" },
          { label: "En attente",value: stats.attente,   color: "text-amber-700"   },
          { label: "Refusés",   value: stats.refuses,   color: "text-red-600"     },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Formulaire */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Nouvelle demande de congé</h2>
          <form onSubmit={soumettre} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium text-slate-600">Type de congé *</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {TYPES_CONGE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date de début *</Label>
              <Input type="date" value={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateDebut: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date de fin *</Label>
              <Input type="date" value={form.dateFin} min={form.dateDebut} onChange={e => setForm(p => ({ ...p, dateFin: e.target.value }))} required />
            </div>
            {nbJoursPrev > 0 && (
              <div className="col-span-2 text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Durée : <strong>{nbJoursPrev} jour(s)</strong>
              </div>
            )}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium text-slate-600">Motif</Label>
              <Input placeholder="Motif optionnel…" value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} />
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving || !form.type || !form.dateDebut || !form.dateFin}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#059669" }}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Soumettre
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Mes demandes</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : conges.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucune demande de congé</p>
            <p className="text-xs mt-1">Cliquez sur &ldquo;Nouvelle demande&rdquo; pour en soumettre une</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {conges.map(c => {
              const cfg = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.EN_ATTENTE
              const Icon = cfg.icon
              return (
                <div key={c.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{c.type}</p>
                      <span className="text-xs text-slate-400">·</span>
                      <p className="text-xs text-slate-500 font-medium">{c.nbJours} jour(s)</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDateFr(c.dateDebut)} → {formatDateFr(c.dateFin)}
                    </p>
                    {c.motif && <p className="text-xs text-slate-500 mt-0.5 italic">{c.motif}</p>}
                    {c.commentaire && (
                      <p className="text-xs mt-1 text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1">
                        <span className="font-medium">RH :</span> {c.commentaire}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Icon className="h-4 w-4 flex-shrink-0" style={{ color: cfg.color }} />
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {c.statut === "EN_ATTENTE" && (
                      <button
                        onClick={() => annulerDemande(c.id)}
                        disabled={cancellingId === c.id}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Annuler cette demande"
                      >
                        {cancellingId === c.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
