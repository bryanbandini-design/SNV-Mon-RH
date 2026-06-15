"use client"

import { useState } from "react"
import { toast } from "sonner"
import { UserCheck, UserPlus, Loader2, Eye, EyeOff, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  employeId: string
  compte: { id: string; email: string; createdAt: string } | null
}

export function CompteAccessPanel({ employeId, compte: initialCompte }: Props) {
  const [compte, setCompte] = useState(initialCompte)
  const [showForm, setShowForm]   = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [form, setForm] = useState({ email: "", password: "" })

  async function creerCompte(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password) return
    setSaving(true)
    const res = await fetch(`/api/employes/${employeId}/compte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setCompte({ id: data.userId, email: data.email, createdAt: new Date().toISOString() })
      setForm({ email: "", password: "" })
      setShowForm(false)
      toast.success("Accès créé — l'employé peut maintenant se connecter")
    } else {
      toast.error(data.message ?? "Erreur lors de la création")
    }
    setSaving(false)
  }

  async function supprimerCompte() {
    if (!compte) return
    if (!confirm("Supprimer l'accès ? L'employé ne pourra plus se connecter.")) return
    setDeleting(true)
    const res = await fetch(`/api/employes/${employeId}/compte`, { method: "DELETE" })
    if (res.ok) {
      setCompte(null)
      toast.success("Accès supprimé")
    } else {
      toast.error("Erreur lors de la suppression")
    }
    setDeleting(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        {compte ? (
          <UserCheck className="h-4 w-4 text-emerald-500" />
        ) : (
          <UserPlus className="h-4 w-4 text-slate-400" />
        )}
        <span className="font-semibold text-slate-900 text-sm">Accès employé</span>
      </div>

      <div className="p-5">
        {compte ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-start gap-3">
              <UserCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">Accès actif</p>
                <p className="text-xs text-emerald-700 mt-0.5">{compte.email}</p>
                <p className="text-xs text-emerald-600 mt-0.5 opacity-70">
                  Créé le {new Date(compte.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <button onClick={supprimerCompte} disabled={deleting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer l&apos;accès
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Cet employé n&apos;a pas encore d&apos;accès à l&apos;espace employé.</p>
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                <UserPlus className="h-4 w-4" />
                Créer un accès
              </button>
            ) : (
              <form onSubmit={creerCompte} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Email de connexion *</Label>
                  <Input type="email" placeholder="employe@email.com" required
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Mot de passe *</Label>
                  <div className="relative">
                    <Input type={showPass ? "text" : "password"} placeholder="Min 8 caractères" required
                      minLength={8} value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving || !form.email || form.password.length < 8}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "#059669" }}>
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Créer
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
