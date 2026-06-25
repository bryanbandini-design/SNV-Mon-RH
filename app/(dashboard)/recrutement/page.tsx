"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Briefcase, Users, X, ChevronRight, Loader2, ArrowRight, Target, AlertCircle, CheckCircle2, Clock, TrendingUp, Pencil, Trash2, UserPlus } from "lucide-react"
import Link from "next/link"

type Offre = {
  id: string; titre: string; departement: string | null; typeContrat: string
  localisation: string | null; statut: string; priorite: string
  dateOuverture: string; dateCloture: string | null; description: string | null
  salaireFourchette: string | null
  _count: { candidats: number }
}

const STATUT_OFFRE = ["OUVERTE", "POURVUE", "SUSPENDUE", "FERMEE"] as const
const PRIORITE     = ["BASSE", "NORMALE", "HAUTE", "URGENTE"]       as const

const STATUT_COLORS: Record<string, string> = {
  OUVERTE:   "bg-green-100 text-green-700",
  POURVUE:   "bg-blue-100 text-blue-700",
  SUSPENDUE: "bg-amber-100 text-amber-700",
  FERMEE:    "bg-slate-100 text-slate-500",
}
const PRIORITE_COLORS: Record<string, string> = {
  BASSE:    "bg-slate-100 text-slate-500",
  NORMALE:  "bg-blue-100 text-blue-600",
  HAUTE:    "bg-orange-100 text-orange-700",
  URGENTE:  "bg-red-100 text-red-700",
}

const emptyForm = { titre: "", departement: "", typeContrat: "CDI", localisation: "", salaireFourchette: "", description: "", statut: "OUVERTE", priorite: "NORMALE", dateCloture: "" }

function formatDate(d: string) { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) }

export default function RecrutementPage() {
  const [offres, setOffres]     = useState<Offre[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [filtre, setFiltre]     = useState("TOUTES")

  useEffect(() => {
    fetch("/api/recrutement/offres").then(r => r.json()).then(d => {
      setOffres(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() =>
    filtre === "TOUTES" ? offres : offres.filter(o => o.statut === filtre),
    [offres, filtre]
  )

  const stats = useMemo(() => ({
    ouvertes:  offres.filter(o => o.statut === "OUVERTE").length,
    urgentes:  offres.filter(o => o.priorite === "URGENTE" && o.statut === "OUVERTE").length,
    candidats: offres.reduce((s, o) => s + o._count.candidats, 0),
    pourvues:  offres.filter(o => o.statut === "POURVUE").length,
  }), [offres])

  function startEdit(o: Offre) {
    setEditId(o.id)
    setForm({ titre: o.titre, departement: o.departement ?? "", typeContrat: o.typeContrat, localisation: o.localisation ?? "", salaireFourchette: o.salaireFourchette ?? "", description: o.description ?? "", statut: o.statut, priorite: o.priorite, dateCloture: o.dateCloture ? o.dateCloture.split("T")[0] : "" })
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const url    = editId ? `/api/recrutement/offres/${editId}` : "/api/recrutement/offres"
    const method = editId ? "PATCH" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, dateCloture: form.dateCloture || null }) })
    const data = await res.json()
    if (editId) setOffres(p => p.map(o => o.id === editId ? { ...o, ...data } : o))
    else setOffres(p => [{ ...data, _count: { candidats: 0 } }, ...p])
    setShowForm(false); setEditId(null); setForm(emptyForm); setSaving(false)
  }

  async function deleteOffre(id: string) {
    if (!confirm("Supprimer cette offre et tous ses candidats ?")) return
    await fetch(`/api/recrutement/offres/${id}`, { method: "DELETE" })
    setOffres(p => p.filter(o => o.id !== id))
  }

  function f(key: keyof typeof form, v: string) { setForm(p => ({ ...p, [key]: v })) }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Recrutement</h1>
          <p className="text-sm text-slate-500 mt-1">Gestion des offres et du pipeline candidats</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">
          <Plus className="h-4 w-4" /> Nouvelle offre
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Postes ouverts",    value: stats.ouvertes,  icon: Briefcase,    color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Urgentes",          value: stats.urgentes,  icon: AlertCircle,  color: "text-red-600",    bg: "bg-red-50"    },
          { label: "Candidats total",   value: stats.candidats, icon: Users,        color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Postes pourvus",    value: stats.pourvues,  icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50"  },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`rounded-xl border border-slate-200 bg-white p-4`}>
              <div className={`h-9 w-9 rounded-xl ${k.bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${k.color}`} />
              </div>
              <p className="text-2xl font-black text-slate-900">{k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900">{editId ? "Modifier l'offre" : "Nouvelle offre d'emploi"}</h2>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Intitulé du poste *</label>
                <input required value={form.titre} onChange={e => f("titre", e.target.value)} placeholder="ex: Développeur React Senior"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              {[
                { key: "departement" as const, label: "Département",     placeholder: "Informatique"   },
                { key: "localisation" as const, label: "Localisation",    placeholder: "Paris, hybride" },
                { key: "salaireFourchette" as const, label: "Fourchette salaire", placeholder: "35-45K €" },
              ].map(fi => (
                <div key={fi.key}>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi.label}</label>
                  <input value={form[fi.key]} onChange={e => f(fi.key, e.target.value)} placeholder={fi.placeholder}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              ))}
              {[
                { key: "typeContrat" as const, label: "Contrat", opts: ["CDI","CDD","STAGE","ALTERNANCE","FREELANCE","INTERIM"] },
                { key: "priorite" as const,    label: "Priorité", opts: [...PRIORITE] },
                { key: "statut" as const,      label: "Statut",   opts: [...STATUT_OFFRE] },
              ].map(fi => (
                <div key={fi.key}>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi.label}</label>
                  <select value={form[fi.key]} onChange={e => f(fi.key, e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                    {fi.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Date de clôture</label>
                <input type="date" value={form.dateCloture} onChange={e => f("dateCloture", e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => f("description", e.target.value)} placeholder="Missions, profil recherché, avantages..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editId ? "Enregistrer" : "Créer l'offre"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        {["TOUTES", ...STATUT_OFFRE].map(s => (
          <button key={s} onClick={() => setFiltre(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtre === s ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            {s === "TOUTES" ? `Toutes (${offres.length})` : `${s} (${offres.filter(o => o.statut === s).length})`}
          </button>
        ))}
      </div>

      {/* Liste des offres */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-slate-200" />
          <p className="font-semibold text-slate-500">Aucune offre{filtre !== "TOUTES" ? ` ${filtre.toLowerCase()}` : ""}</p>
          <p className="text-sm text-slate-400 mt-1">Créez votre première offre d'emploi pour démarrer le recrutement</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(offre => (
            <div key={offre.id} className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all group">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITE_COLORS[offre.priorite]}`}>{offre.priorite}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[offre.statut]}`}>{offre.statut}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{offre.titre}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => startEdit(offre)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                    <button onClick={() => deleteOffre(offre.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{offre.typeContrat}</span>
                  {offre.departement && <span>{offre.departement}</span>}
                  {offre.localisation && <span>{offre.localisation}</span>}
                  {offre.salaireFourchette && <span className="font-medium text-emerald-600">{offre.salaireFourchette}</span>}
                </div>

                {offre.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{offre.description}</p>
                )}
              </div>

              <div className="px-5 pb-5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(offre.dateOuverture)}</span>
                  {offre.dateCloture && <span>→ {formatDate(offre.dateCloture)}</span>}
                </div>
                <Link href={`/recrutement/${offre.id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                  <UserPlus className="h-3.5 w-3.5" />
                  {offre._count.candidats} candidat(s)
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
