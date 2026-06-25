"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, GraduationCap, Users, X, Loader2, CheckCircle2, Clock, Award, Pencil, Trash2, UserPlus, UserMinus, Star } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Employe = { id: string; prenom: string; nom: string; poste: string }
type Participation = { employeId: string; statut: string; note: number | null; certificat: boolean; employe: { prenom: string; nom: string; poste: string } }
type Formation = {
  id: string; titre: string; type: string; organisme: string | null; description: string | null
  dureeHeures: number | null; cout: number | null; dateDebut: string | null; dateFin: string | null
  lieu: string | null; statut: string; maxParticipants: number | null; createdAt: string
  _count: { participations: number }; participations: Participation[]
}

const TYPES    = ["INTERNE","EXTERNE","E_LEARNING","CERTIFICATION"]
const STATUTS  = ["PLANIFIE","EN_COURS","TERMINE","ANNULE"]
const PART_STATUTS = ["INSCRIT","PRESENT","ABSENT","VALIDE","ECHEC"]

const TYPE_COLORS: Record<string,string> = {
  INTERNE:       "bg-blue-100 text-blue-700",
  EXTERNE:       "bg-purple-100 text-purple-700",
  E_LEARNING:    "bg-cyan-100 text-cyan-700",
  CERTIFICATION: "bg-amber-100 text-amber-700",
}
const STATUT_COLORS: Record<string,string> = {
  PLANIFIE: "bg-slate-100 text-slate-600",
  EN_COURS: "bg-blue-100 text-blue-700",
  TERMINE:  "bg-green-100 text-green-700",
  ANNULE:   "bg-red-100 text-red-600",
}

const emptyForm = { titre: "", type: "INTERNE", organisme: "", description: "", dureeHeures: "", cout: "", dateDebut: "", dateFin: "", lieu: "", statut: "PLANIFIE", maxParticipants: "" }

function formatDate(d: string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function FormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([])
  const [employes, setEmployes]     = useState<Employe[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(emptyForm)
  const [editId, setEditId]         = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [selected, setSelected]     = useState<Formation | null>(null)
  const [filtreStatut, setFiltreStatut] = useState("TOUS")
  const [inscribeId, setInscribeId] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/formations").then(r => r.json()),
      fetch("/api/employes").then(r => r.json()),
    ]).then(([f, e]) => {
      setFormations(Array.isArray(f) ? f : [])
      setEmployes(Array.isArray(e) ? e : [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() =>
    filtreStatut === "TOUS" ? formations : formations.filter(f => f.statut === filtreStatut),
    [formations, filtreStatut]
  )

  const stats = useMemo(() => ({
    total:    formations.length,
    enCours:  formations.filter(f => f.statut === "EN_COURS").length,
    termines: formations.filter(f => f.statut === "TERMINE").length,
    participants: formations.reduce((s, f) => s + f._count.participations, 0),
  }), [formations])

  function startEdit(f: Formation) {
    setEditId(f.id)
    setForm({ titre: f.titre, type: f.type, organisme: f.organisme ?? "", description: f.description ?? "", dureeHeures: f.dureeHeures?.toString() ?? "", cout: f.cout?.toString() ?? "", dateDebut: f.dateDebut?.split("T")[0] ?? "", dateFin: f.dateFin?.split("T")[0] ?? "", lieu: f.lieu ?? "", statut: f.statut, maxParticipants: f.maxParticipants?.toString() ?? "" })
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const url    = editId ? `/api/formations/${editId}` : "/api/formations"
    const method = editId ? "PATCH" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const data = await res.json()
    if (editId) setFormations(p => p.map(f => f.id === editId ? { ...f, ...data } : f))
    else setFormations(p => [{ ...data, _count: { participations: 0 }, participations: [] }, ...p])
    setShowForm(false); setEditId(null); setForm(emptyForm); setSaving(false)
  }

  async function deleteFormation(id: string) {
    if (!confirm("Supprimer cette formation ?")) return
    await fetch(`/api/formations/${id}`, { method: "DELETE" })
    setFormations(p => p.filter(f => f.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function inscrire() {
    if (!inscribeId || !selected) return
    const res = await fetch(`/api/formations/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "INSCRIRE", employeId: inscribeId }),
    })
    if (!res.ok) return
    const p = await res.json()
    const updated = { ...selected, _count: { participations: selected._count.participations + 1 }, participations: [...selected.participations, p] }
    setSelected(updated)
    setFormations(prev => prev.map(f => f.id === selected.id ? updated : f))
    setInscribeId("")
  }

  async function majParticipation(employeId: string, field: string, value: unknown) {
    if (!selected) return
    await fetch(`/api/formations/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "MAJ_PARTICIPATION", employeId, [field]: value }),
    })
    const updated = { ...selected, participations: selected.participations.map(p => p.employeId === employeId ? { ...p, [field]: value } : p) }
    setSelected(updated)
    setFormations(prev => prev.map(f => f.id === selected.id ? updated : f))
  }

  async function desinscrire(employeId: string) {
    if (!selected) return
    await fetch(`/api/formations/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DESINSCRIRE", employeId }),
    })
    const updated = { ...selected, _count: { participations: selected._count.participations - 1 }, participations: selected.participations.filter(p => p.employeId !== employeId) }
    setSelected(updated)
    setFormations(prev => prev.map(f => f.id === selected.id ? updated : f))
  }

  const inscrits = new Set(selected?.participations.map(p => p.employeId) ?? [])
  const disponibles = employes.filter(e => !inscrits.has(e.id))

  function fi(key: keyof typeof form, v: string) { setForm(p => ({ ...p, [key]: v })) }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Formations</h1>
          <p className="text-sm text-slate-500 mt-1">Plan de développement des compétences</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouvelle formation</span><span className="sm:hidden">Nouvelle</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total formations", value: stats.total,       icon: GraduationCap, color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "En cours",         value: stats.enCours,     icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50"  },
          { label: "Terminées",        value: stats.termines,    icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Participants",     value: stats.participants, icon: Users,         color: "text-purple-600", bg: "bg-purple-50" },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className={`h-9 w-9 rounded-xl ${k.bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${k.color}`} />
              </div>
              <p className="text-2xl font-black text-slate-900">{k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900">{editId ? "Modifier la formation" : "Nouvelle formation"}</h2>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4 text-slate-400" /></button>
          </div>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Titre de la formation *</label>
              <input required value={form.titre} onChange={e => fi("titre", e.target.value)} placeholder="ex: Excel avancé, Habilitation électrique..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            {[
              { key: "type" as const,   label: "Type",   opts: TYPES   },
              { key: "statut" as const, label: "Statut", opts: STATUTS },
            ].map(fi2 => (
              <div key={fi2.key}>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi2.label}</label>
                <select value={form[fi2.key]} onChange={e => fi(fi2.key, e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                  {fi2.opts.map(o => <option key={o} value={o}>{o.replace("_"," ")}</option>)}
                </select>
              </div>
            ))}
            {[
              { key: "organisme" as const, label: "Organisme", placeholder: "CNAM, OpenClassrooms..." },
              { key: "lieu" as const,      label: "Lieu",      placeholder: "Paris, En ligne..."      },
              { key: "dureeHeures" as const, label: "Durée (h)", placeholder: "14" },
              { key: "cout" as const,        label: "Coût (€)",  placeholder: "1200" },
              { key: "maxParticipants" as const, label: "Places max", placeholder: "12" },
            ].map(fi2 => (
              <div key={fi2.key}>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi2.label}</label>
                <input value={form[fi2.key]} onChange={e => fi(fi2.key, e.target.value)} placeholder={fi2.placeholder}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Date début</label>
              <input type="date" value={form.dateDebut} onChange={e => fi("dateDebut", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Date fin</label>
              <input type="date" value={form.dateFin} onChange={e => fi("dateFin", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Description / Objectifs</label>
              <textarea rows={2} value={form.description} onChange={e => fi("description", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editId ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {["TOUS", ...STATUTS].map(s => (
          <button key={s} onClick={() => setFiltreStatut(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtreStatut === s ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            {s === "TOUS" ? `Toutes (${formations.length})` : `${s.replace("_"," ")} (${formations.filter(f => f.statut === s).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-500">Aucune formation</p>
            <p className="text-sm text-slate-400 mt-1">Commencez par créer votre plan de formation</p>
          </div>
        ) : filtered.map(f => (
          <div key={f.id}
            className={`rounded-xl border bg-white hover:shadow-sm transition-all cursor-pointer group ${selected?.id === f.id ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200 hover:border-slate-300"}`}
            onClick={() => setSelected(selected?.id === f.id ? null : { ...f })}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[f.type] ?? "bg-slate-100 text-slate-500"}`}>{f.type.replace("_"," ")}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[f.statut]}`}>{f.statut.replace("_"," ")}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 truncate">{f.titre}</h3>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); startEdit(f) }} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="h-3.5 w-3.5 text-slate-400" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteFormation(f.id) }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                {f.organisme    && <span>{f.organisme}</span>}
                {f.dureeHeures  && <span>{f.dureeHeures}h</span>}
                {f.cout         && <span className="text-emerald-600 font-medium">{formatCurrency(f.cout)}</span>}
                {f.dateDebut    && <span>{formatDate(f.dateDebut)}{f.dateFin ? ` → ${formatDate(f.dateFin)}` : ""}</span>}
              </div>
            </div>
            <div className="px-5 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="h-3.5 w-3.5" />
                <span>{f._count.participations}{f.maxParticipants ? `/${f.maxParticipants}` : ""} participant(s)</span>
              </div>
              {f.participations.filter(p => p.certificat).length > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Award className="h-3.5 w-3.5" />
                  <span>{f.participations.filter(p => p.certificat).length} certifié(s)</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Panneau détail formation + participants */}
      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{selected.titre} — Participants</h3>
            <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4 text-slate-400" /></button>
          </div>

          {/* Inscrire un employé */}
          {disponibles.length > 0 && (
            <div className="flex items-center gap-3">
              <select value={inscribeId} onChange={e => setInscribeId(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">Sélectionner un employé à inscrire...</option>
                {disponibles.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</option>)}
              </select>
              <button onClick={inscrire} disabled={!inscribeId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors">
                <UserPlus className="h-4 w-4" /> Inscrire
              </button>
            </div>
          )}

          {/* Liste participants */}
          {selected.participations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun participant inscrit</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 text-left">
                    <th className="py-2 pr-4 font-semibold">Employé</th>
                    <th className="py-2 pr-4 font-semibold">Statut</th>
                    <th className="py-2 pr-4 font-semibold">Note</th>
                    <th className="py-2 pr-4 font-semibold">Certifié</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selected.participations.map(p => (
                    <tr key={p.employeId} className="hover:bg-slate-50/60">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">{p.employe.prenom} {p.employe.nom}</p>
                        <p className="text-xs text-slate-400">{p.employe.poste}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <select value={p.statut} onChange={e => majParticipation(p.employeId, "statut", e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300">
                          {PART_STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} onClick={() => majParticipation(p.employeId, "note", n)}>
                              <Star className={`h-3.5 w-3.5 ${n <= (p.note ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <button onClick={() => majParticipation(p.employeId, "certificat", !p.certificat)}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${p.certificat ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500 hover:bg-amber-50"}`}>
                          {p.certificat ? "✓ Oui" : "Non"}
                        </button>
                      </td>
                      <td className="py-3">
                        <button onClick={() => desinscrire(p.employeId)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                          <UserMinus className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
