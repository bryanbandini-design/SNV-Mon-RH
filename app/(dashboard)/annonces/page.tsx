"use client"

import { useState, useEffect } from "react"
import { Plus, Megaphone, Trash2, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Annonce = { id: string; titre: string; contenu: string; type: string; auteur: string; createdAt: string }

const TYPE_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  INFO:      { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", label: "Info" },
  IMPORTANT: { bg: "#fffbeb", border: "#fcd34d", text: "#d97706", label: "Important" },
  URGENT:    { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", label: "Urgent" },
}

export default function AnnoncesPage() {
  const [annonces, setAnnonces]   = useState<Annonce[]>([])
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm] = useState({ titre: "", contenu: "", type: "INFO" })

  useEffect(() => {
    fetch("/api/annonces").then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d)) setAnnonces(d)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/annonces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const n = await res.json()
      setAnnonces(prev => [n, ...prev])
      setShowForm(false)
      setForm({ titre: "", contenu: "", type: "INFO" })
      toast.success("Annonce publiée — visible par tous les employés")
    } else toast.error("Erreur lors de la publication")
    setSaving(false)
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer cette annonce ?")) return
    const res = await fetch(`/api/annonces/${id}`, { method: "DELETE" })
    if (res.ok) { setAnnonces(prev => prev.filter(a => a.id !== id)); toast.success("Annonce supprimée") }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Annonces internes</h1>
          <p className="text-sm text-slate-500 mt-1">Publiez des messages visibles par tous les employés dans leur espace</p>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
          <Plus className="h-4 w-4" />
          Nouvelle annonce
        </button>
      </div>

      {/* Formulaire */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-indigo-500" />
              Nouvelle annonce
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Titre *</Label>
                <Input value={form.titre} onChange={e => setForm(p => ({ ...p, titre: e.target.value }))} placeholder="Ex : Fermeture exceptionnelle du 24 décembre" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Message *</Label>
              <Textarea value={form.contenu} onChange={e => setForm(p => ({ ...p, contenu: e.target.value }))} placeholder="Contenu de l'annonce visible par tous les employés..." rows={4} required />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white">Annuler</button>
              <button type="submit" disabled={saving || !form.titre || !form.contenu}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Publier
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Liste */}
      {annonces.length === 0 ? (
        <div className="text-center py-20 text-slate-400 rounded-xl border border-slate-200 bg-white">
          <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-slate-500">Aucune annonce publiée</p>
          <p className="text-sm mt-1">Les annonces apparaissent dans l'espace de chaque employé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {annonces.map(a => {
            const s = TYPE_STYLE[a.type] ?? TYPE_STYLE.INFO
            return (
              <div key={a.id} className="rounded-xl border bg-white p-5"
                style={{ borderColor: s.border }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{ background: s.bg, borderColor: s.border, color: s.text }}>
                      {s.label}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{a.titre}</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{a.contenu}</p>
                      <p className="text-xs text-slate-400 mt-2">{a.auteur} · {new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                    </div>
                  </div>
                  <button onClick={() => supprimer(a.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
