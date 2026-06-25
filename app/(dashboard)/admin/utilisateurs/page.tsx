"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users, Plus, Pencil, Trash2, ShieldCheck,
  Loader2, X, Eye, EyeOff, AlertCircle, Check,
  UserCog, KeyRound, Mail, Search,
} from "lucide-react"
import { PERM_GROUPS, PERM_LABELS, DEFAULT_PERMISSIONS } from "@/lib/permissions"
import type { PermKey } from "@/lib/permissions"

type Employe = { prenom: string; nom: string; poste: string; departement: string | null; statut: string }
type EmployeOption = { id: string; prenom: string; nom: string; poste: string | null; userRole: string | null }
type User = {
  id:          string
  email:       string
  name:        string
  role:        string
  permissions: string
  employeId:   string | null
  createdAt:   string
  employe:     Employe | null
}

const ROLES = [
  { value: "ADMIN",       label: "Administrateur", color: "bg-blue-100 text-blue-700" },
  { value: "RH",          label: "RH",             color: "bg-purple-100 text-purple-700" },
  { value: "RESPONSABLE", label: "Responsable",    color: "bg-emerald-100 text-emerald-700" },
  { value: "EMPLOYE",     label: "Employé",        color: "bg-slate-100 text-slate-600" },
]

function roleBadge(role: string) {
  const r = ROLES.find(r => r.value === role)
  return r ? (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
  ) : null
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

function avatarColor(role: string) {
  if (role === "ADMIN")       return "from-blue-500 to-indigo-600"
  if (role === "RH")          return "from-purple-500 to-violet-600"
  if (role === "RESPONSABLE") return "from-emerald-500 to-teal-600"
  return "from-slate-400 to-slate-500"
}

// ── Modal création / édition ───────────────────────────────────────────────

type ModalProps = {
  user?: User | null
  onClose: () => void
  onSaved: () => void
}

function UserModal({ user, onClose, onSaved }: ModalProps) {
  const isEdit = !!user

  const initialPerms: PermKey[] = (() => {
    if (user?.permissions) {
      try { return JSON.parse(user.permissions) as PermKey[] } catch { return [] }
    }
    return DEFAULT_PERMISSIONS[user?.role ?? "RH"] ?? []
  })()

  const [name,        setName]        = useState(user?.name ?? "")
  const [email,       setEmail]       = useState(user?.email ?? "")
  const [role,        setRole]        = useState(user?.role ?? "RH")
  const [password,    setPassword]    = useState("")
  const [showPwd,     setShowPwd]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [employes,    setEmployes]    = useState<EmployeOption[]>([])
  const [employeId,   setEmployeId]   = useState("")
  const [loadingEmp,  setLoadingEmp]  = useState(false)
  const [permissions, setPermissions] = useState<PermKey[]>(initialPerms)

  // Quand le rôle change, réinitialise les permissions par défaut
  function handleRoleChange(newRole: string) {
    setRole(newRole)
    setEmployeId("")
    setPermissions(DEFAULT_PERMISSIONS[newRole] ?? [])
  }

  function togglePerm(key: PermKey) {
    setPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    )
  }

  function toggleGroup(keys: PermKey[]) {
    const allOn = keys.every(k => permissions.includes(k))
    if (allOn) {
      setPermissions(prev => prev.filter(p => !keys.includes(p)))
    } else {
      setPermissions(prev => [...new Set([...prev, ...keys])])
    }
  }

  useEffect(() => {
    if (role === "EMPLOYE" && !isEdit) {
      setLoadingEmp(true)
      fetch("/api/employes")
        .then(r => r.json())
        .then((data: EmployeOption[]) => {
          const list: EmployeOption[] = Array.isArray(data) ? data : []
          setEmployes(list.filter((e: EmployeOption) => !e.userRole))
        })
        .catch(() => setEmployes([]))
        .finally(() => setLoadingEmp(false))
    }
  }, [role, isEdit])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = { email, role, permissions }
      if (name) body.name = name
      if (password) body.password = password
      if (role === "EMPLOYE" && employeId) body.employeId = employeId

      const res = isEdit
        ? await fetch(`/api/admin/users/${user!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, password }),
          })

      const data = await res.json()
      if (!res.ok) { setError(data.message ?? "Erreur"); return }
      onSaved()
      onClose()
    } catch {
      setError("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  const selectedEmploye = employes.find(e => e.id === employeId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
              {isEdit ? <UserCog className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">
                {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </p>
              <p className="text-xs text-slate-500">{isEdit ? user!.email : "Créer un accès à l'application"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form — scrollable */}
        <form onSubmit={submit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Rôle */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Rôle <span className="text-red-400">*</span></label>
            <select value={role} onChange={e => handleRoleChange(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              disabled={isEdit}>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Sélecteur d'employé */}
          {role === "EMPLOYE" && !isEdit && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Employé à lier <span className="text-red-400">*</span>
              </label>
              {loadingEmp ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
              ) : employes.length === 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                  Tous les employés ont déjà un compte, ou aucun employé trouvé.
                </div>
              ) : (
                <select value={employeId} onChange={e => {
                    setEmployeId(e.target.value)
                    const emp = employes.find(emp => emp.id === e.target.value)
                    if (emp) setName(`${emp.prenom} ${emp.nom}`)
                  }}
                  required
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">— Sélectionner un employé —</option>
                  {employes.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.prenom} {emp.nom}{emp.poste ? ` — ${emp.poste}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedEmploye && (
                <p className="text-[11px] text-emerald-600 mt-1.5">
                  ✓ Compte lié à : {selectedEmploye.prenom} {selectedEmploye.nom}
                </p>
              )}
            </div>
          )}

          {/* Nom */}
          {role !== "EMPLOYE" && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Nom complet <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} required
                placeholder="Jean-Paul Mbarga"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> Email <span className="text-red-400">*</span></span>
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="jmbarga@entreprise.cm"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Mot de passe */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Mot de passe {isEdit ? <span className="text-slate-400 font-normal">(laisser vide pour ne pas changer)</span> : <span className="text-red-400">*</span>}
              </span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required={!isEdit}
                placeholder={isEdit ? "••••••••" : "Min. 8 caractères"}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* ── Permissions ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Accès aux modules</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPermissions(PERM_GROUPS.flatMap(g => g.keys))}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">Tout cocher</button>
                <span className="text-slate-300 text-xs">·</span>
                <button type="button" onClick={() => setPermissions([])}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-medium">Tout décocher</button>
              </div>
            </div>

            <div className="space-y-3">
              {PERM_GROUPS.map(group => {
                const allOn  = group.keys.every(k => permissions.includes(k))
                const someOn = group.keys.some(k => permissions.includes(k))
                return (
                  <div key={group.label} className="rounded-xl border border-slate-100 overflow-hidden">
                    {/* En-tête groupe */}
                    <button type="button"
                      onClick={() => toggleGroup(group.keys)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                        allOn  ? "bg-blue-600 border-blue-600" :
                        someOn ? "bg-blue-100 border-blue-300" :
                                 "bg-white border-slate-300"
                      }`}>
                        {allOn && <Check className="h-2.5 w-2.5 text-white" />}
                        {someOn && !allOn && <div className="h-1.5 w-1.5 rounded-sm bg-blue-600" />}
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{group.label}</span>
                      <span className="ml-auto text-[10px] text-slate-400">
                        {group.keys.filter(k => permissions.includes(k)).length}/{group.keys.length}
                      </span>
                    </button>

                    {/* Cases individuelles */}
                    <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {group.keys.map(key => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer group">
                          <div
                            onClick={() => togglePerm(key)}
                            className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border cursor-pointer transition-all ${
                              permissions.includes(key)
                                ? "bg-blue-600 border-blue-600"
                                : "bg-white border-slate-300 group-hover:border-blue-400"
                            }`}>
                            {permissions.includes(key) && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span onClick={() => togglePerm(key)}
                            className="text-xs text-slate-600 group-hover:text-slate-900 truncate">
                            {PERM_LABELS[key]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </form>

        {/* Footer — fixe */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button
            form="" onClick={e => { e.preventDefault(); const form = (e.target as HTMLElement).closest(".bg-white")?.querySelector("form"); if (form) form.requestSubmit() }}
            disabled={saving || (role === "EMPLOYE" && !isEdit && !employeId)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? "Enregistrer" : "Créer le compte"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirmation suppression ───────────────────────────────────────────────

function DeleteConfirm({ user, onClose, onDeleted }: { user: User; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function confirm() {
    setDeleting(true); setError(null)
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
    if (res.ok) { onDeleted(); onClose() }
    else { const d = await res.json(); setError(d.message ?? "Erreur"); setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Supprimer le compte</p>
            <p className="text-sm text-slate-500">{user.name}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Cette action est irréversible. L&apos;utilisateur ne pourra plus se connecter.
          {user.employe && " La fiche employé associée ne sera pas supprimée."}
        </p>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function UtilisateursPage() {
  const [users,    setUsers]    = useState<User[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState("")
  const [modal,    setModal]    = useState<"create" | "edit" | "delete" | null>(null)
  const [selected, setSelected] = useState<User | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch("/api/admin/users").then(r => r.json()).then(d => {
      setUsers(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:       users.length,
    admins:      users.filter(u => u.role === "ADMIN").length,
    rh:          users.filter(u => u.role === "RH").length,
    responsables: users.filter(u => u.role === "RESPONSABLE").length,
    employes:    users.filter(u => u.role === "EMPLOYE").length,
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Modals */}
      {modal === "create" && (
        <UserModal onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal === "edit" && selected && (
        <UserModal user={selected} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal === "delete" && selected && (
        <DeleteConfirm user={selected} onClose={() => setModal(null)} onDeleted={load} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-1">Comptes d'accès à l'application — ADMIN uniquement</p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">
          <Plus className="h-4 w-4" /> Nouvel utilisateur
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",         value: stats.total,        color: "text-slate-900",   bg: "bg-slate-50  border-slate-200" },
          { label: "Administrateurs", value: stats.admins,     color: "text-blue-700",    bg: "bg-blue-50   border-blue-200"  },
          { label: "RH",            value: stats.rh,           color: "text-purple-700",  bg: "bg-purple-50 border-purple-200"},
          { label: "Responsables",  value: stats.responsables, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200"},
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email ou rôle…"
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users className="h-10 w-10 text-slate-200" />
            <p className="text-slate-400 text-sm">
              {search ? "Aucun résultat pour cette recherche" : "Aucun utilisateur"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-6 py-3">Utilisateur</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Rôle</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell">Fiche employé</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden sm:table-cell">Créé le</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarColor(u.role)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {roleBadge(u.role)}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    {u.employe ? (
                      <div>
                        <p className="text-slate-700 font-medium">{u.employe.prenom} {u.employe.nom}</p>
                        <p className="text-xs text-slate-400">{u.employe.poste}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-400 hidden sm:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setSelected(u); setModal("edit") }}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setSelected(u); setModal("delete") }}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Légende rôles */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Droits par rôle</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          {[
            { role: "ADMIN",       color: "bg-blue-100 text-blue-700",     desc: "Accès complet : paramètres, utilisateurs, toutes les fonctionnalités" },
            { role: "RH",          color: "bg-purple-100 text-purple-700", desc: "Employés, congés, salaires, recrutement, formations, disciplinaire" },
            { role: "RESPONSABLE", color: "bg-emerald-100 text-emerald-700", desc: "Demandes disciplinaires, approbation congés de son équipe, pointage" },
            { role: "EMPLOYE",     color: "bg-slate-100 text-slate-600",   desc: "Mon espace uniquement : profil, fiches de paie, congés, planning" },
          ].map(r => (
            <div key={r.role} className="flex items-start gap-2.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${r.color}`}>{r.role}</span>
              <p>{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
