"use client"

import { useState } from "react"
import { toast } from "sonner"
import { UserCheck, UserPlus, Loader2, Eye, EyeOff, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PERM_GROUPS, PERM_LABELS, DEFAULT_PERMISSIONS } from "@/lib/permissions"
import type { PermKey } from "@/lib/permissions"

type Props = {
  employeId: string
  compte: { id: string; email: string; role?: string; createdAt: string } | null
}

const ROLES = [
  { value: "EMPLOYE",     label: "Employé",        desc: "Accès à l'espace personnel uniquement" },
  { value: "RESPONSABLE", label: "Responsable",    desc: "Gestion d'équipe, validations" },
  { value: "RH",          label: "RH",             desc: "Accès RH complet sauf administration" },
  { value: "ADMIN",       label: "Administrateur", desc: "Accès total à la plateforme" },
]

const ROLE_COLORS: Record<string, string> = {
  ADMIN:       "bg-blue-100 text-blue-700",
  RH:          "bg-purple-100 text-purple-700",
  RESPONSABLE: "bg-emerald-100 text-emerald-700",
  EMPLOYE:     "bg-slate-100 text-slate-600",
}

export function CompteAccessPanel({ employeId, compte: initialCompte }: Props) {
  const [compte, setCompte]     = useState(initialCompte)
  const [showForm, setShowForm] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [role, setRole]         = useState<string>("EMPLOYE")
  const [permissions, setPermissions] = useState<PermKey[]>(DEFAULT_PERMISSIONS["EMPLOYE"] ?? [])
  const [form, setForm]         = useState({ identifiant: "", password: "" })

  function handleRoleChange(newRole: string) {
    setRole(newRole)
    setPermissions(DEFAULT_PERMISSIONS[newRole] ?? [])
  }

  function togglePerm(key: PermKey) {
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  function toggleGroup(keys: PermKey[]) {
    const allOn = keys.every(k => permissions.includes(k))
    setPermissions(prev => allOn ? prev.filter(p => !keys.includes(p)) : [...new Set([...prev, ...keys])])
  }

  async function creerCompte(e: React.FormEvent) {
    e.preventDefault()
    if (!form.identifiant || !form.password) return
    setSaving(true)
    const identifiant = form.identifiant.trim()
    const email = identifiant.includes("@") ? identifiant : `${identifiant}@local`
    const res = await fetch(`/api/employes/${employeId}/compte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: form.password, role, permissions }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setCompte({ id: data.userId, email: data.email, role, createdAt: new Date().toISOString() })
      setForm({ identifiant: "", password: "" })
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-emerald-800">Accès actif</p>
                  {compte.role && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[compte.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {ROLES.find(r => r.value === compte.role)?.label ?? compte.role}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-700 mt-0.5 font-mono">{compte.email.replace(/@local$/, "")}</p>
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
              <form onSubmit={creerCompte} className="space-y-4">

                {/* Rôle */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Rôle *</Label>
                  <select
                    value={role}
                    onChange={e => handleRoleChange(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                    ))}
                  </select>
                </div>

                {/* Identifiant */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Identifiant de connexion *</Label>
                  <Input
                    type="text"
                    placeholder="ex : valerynoo ou email@domaine.com"
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={form.identifiant}
                    onChange={e => setForm(p => ({ ...p, identifiant: e.target.value }))} />
                  <p className="text-[10px] text-slate-400">
                    Sans @, un identifiant interne est créé (ex&nbsp;: valerynoo). Avec @, l&apos;email est utilisé tel quel.
                  </p>
                </div>

                {/* Mot de passe */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Mot de passe *</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Min 8 caractères"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Permissions (collapsible) */}
                <div>
                  <button type="button"
                    onClick={() => setShowPerms(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-600">
                    <span>Permissions d&apos;accès aux modules</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-normal">{permissions.length} actives</span>
                      {showPerms ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>

                  {showPerms && (
                    <div className="mt-2 space-y-2 border border-slate-100 rounded-lg p-3">
                      <div className="flex gap-3 mb-2">
                        <button type="button" onClick={() => setPermissions(PERM_GROUPS.flatMap(g => g.keys))}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">Tout cocher</button>
                        <span className="text-slate-300">·</span>
                        <button type="button" onClick={() => setPermissions([])}
                          className="text-[10px] text-slate-400 hover:text-slate-600 font-medium">Tout décocher</button>
                      </div>
                      {PERM_GROUPS.map(group => {
                        const allOn  = group.keys.every(k => permissions.includes(k))
                        const someOn = group.keys.some(k => permissions.includes(k))
                        return (
                          <div key={group.label} className="rounded-lg border border-slate-100 overflow-hidden">
                            <button type="button" onClick={() => toggleGroup(group.keys)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                              <div className={`h-3.5 w-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                allOn  ? "bg-blue-600 border-blue-600" :
                                someOn ? "bg-blue-100 border-blue-300" :
                                         "bg-white border-slate-300"
                              }`}>
                                {allOn  && <Check className="h-2 w-2 text-white" />}
                                {someOn && !allOn && <div className="h-1.5 w-1.5 rounded-sm bg-blue-600" />}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-600 flex-1 text-left">{group.label}</span>
                              <span className="text-[10px] text-slate-400">
                                {group.keys.filter(k => permissions.includes(k)).length}/{group.keys.length}
                              </span>
                            </button>
                            <div className="px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
                              {group.keys.map(key => (
                                <label key={key} className="flex items-center gap-1.5 cursor-pointer group">
                                  <div onClick={() => togglePerm(key)}
                                    className={`h-3.5 w-3.5 rounded flex items-center justify-center flex-shrink-0 border cursor-pointer transition-all ${
                                      permissions.includes(key)
                                        ? "bg-blue-600 border-blue-600"
                                        : "bg-white border-slate-300 group-hover:border-blue-400"
                                    }`}>
                                    {permissions.includes(key) && <Check className="h-2 w-2 text-white" />}
                                  </div>
                                  <span onClick={() => togglePerm(key)}
                                    className="text-[10px] text-slate-600 group-hover:text-slate-900 truncate">
                                    {PERM_LABELS[key]}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setShowForm(false); setRole("EMPLOYE"); setPermissions(DEFAULT_PERMISSIONS["EMPLOYE"] ?? []); setForm({ identifiant: "", password: "" }) }}
                    className="flex-1 px-3 py-2 rounded-lg text-xs text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving || !form.identifiant || form.password.length < 8}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "#059669" }}>
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Créer l&apos;accès
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
