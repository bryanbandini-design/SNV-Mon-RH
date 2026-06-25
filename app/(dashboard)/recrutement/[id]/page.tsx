"use client"

import { useState, useEffect, use } from "react"
import {
  ArrowLeft, Plus, X, Loader2, Mail, Phone, Star, Trash2,
  ChevronRight, ChevronLeft, Pencil, Briefcase, MapPin,
  Banknote, Calendar, Clock, Tag, FileText, AlertCircle,
} from "lucide-react"
import Link from "next/link"

type Entretien = { id: string; type: string; date: string; note: number | null; statut: string; intervieweur: string | null }
type Candidat  = {
  id: string; prenom: string; nom: string; email: string | null; telephone: string | null
  source: string | null; statut: string; noteGlobale: number | null; commentaire: string | null
  createdAt: string; offre: { titre: string }; entretiens: Entretien[]
}
type Offre = {
  id: string; titre: string; departement: string | null; typeContrat: string; statut: string
  priorite: string; localisation: string | null; salaireFourchette: string | null
  description: string | null; dateOuverture: string; dateCloture: string | null
  _count: { candidats: number }
}

const PIPELINE: { key: string; label: string; color: string; bg: string }[] = [
  { key: "RECU",      label: "Reçus",       color: "#64748b", bg: "#f8fafc" },
  { key: "QUALIFIE",  label: "Qualifiés",   color: "#3b82f6", bg: "#eff6ff" },
  { key: "ENTRETIEN", label: "Entretiens",  color: "#8b5cf6", bg: "#f5f3ff" },
  { key: "TEST",      label: "Tests",       color: "#f59e0b", bg: "#fffbeb" },
  { key: "OFFRE",     label: "Offre faite", color: "#10b981", bg: "#ecfdf5" },
  { key: "EMBAUCHE",  label: "Embauchés",   color: "#059669", bg: "#d1fae5" },
  { key: "REFUSE",    label: "Refusés",     color: "#ef4444", bg: "#fef2f2" },
]

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

const SOURCE_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn", INDEED: "Indeed", RECOMMANDATION: "Recommandation",
  SITE_WEB: "Site web", AUTRE: "Autre",
}

function StarRating({ value, onChange }: { value: number | null; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`h-3.5 w-3.5 ${n <= (value ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
        </button>
      ))}
    </div>
  )
}

function fmt(d: string) { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) }

export default function OffrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [offre, setOffre]           = useState<Offre | null>(null)
  const [candidats, setCandidats]   = useState<Candidat[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Candidat | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [form, setForm] = useState({ prenom: "", nom: "", email: "", telephone: "", source: "", commentaire: "" })
  const [editForm, setEditForm] = useState({
    titre: "", departement: "", typeContrat: "CDI", localisation: "",
    salaireFourchette: "", description: "", statut: "OUVERTE", priorite: "NORMALE", dateCloture: "",
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/recrutement/offres/${id}`).then(r => r.json()),
      fetch(`/api/recrutement/candidats?offreId=${id}`).then(r => r.json()),
    ]).then(([offreData, cands]) => {
      setOffre(offreData?.id ? offreData : null)
      setCandidats(Array.isArray(cands) ? cands : [])
      setLoading(false)
    })
  }, [id])

  function openEdit() {
    if (!offre) return
    setEditForm({
      titre:             offre.titre,
      departement:       offre.departement ?? "",
      typeContrat:       offre.typeContrat,
      localisation:      offre.localisation ?? "",
      salaireFourchette: offre.salaireFourchette ?? "",
      description:       offre.description ?? "",
      statut:            offre.statut,
      priorite:          offre.priorite,
      dateCloture:       offre.dateCloture ? offre.dateCloture.split("T")[0] : "",
    })
    setShowEdit(true)
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    setSavingEdit(true)
    const res = await fetch(`/api/recrutement/offres/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, dateCloture: editForm.dateCloture || null }),
    })
    const data = await res.json()
    setOffre(prev => prev ? { ...prev, ...data } : prev)
    setShowEdit(false)
    setSavingEdit(false)
  }

  function ef(key: keyof typeof editForm, v: string) { setEditForm(p => ({ ...p, [key]: v })) }

  async function addCandidat(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch("/api/recrutement/candidats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, offreId: id }),
    })
    const data = await res.json()
    setCandidats(p => [{ ...data, entretiens: [], offre: { titre: offre?.titre ?? "" } }, ...p])
    setShowForm(false); setForm({ prenom: "", nom: "", email: "", telephone: "", source: "", commentaire: "" }); setSaving(false)
  }

  async function moveCandidat(candidatId: string, newStatut: string) {
    const res = await fetch(`/api/recrutement/candidats/${candidatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: newStatut }),
    })
    const data = await res.json()
    setCandidats(p => p.map(c => c.id === candidatId ? { ...c, statut: data.statut } : c))
    if (selected?.id === candidatId) setSelected(s => s ? { ...s, statut: data.statut } : s)
  }

  async function updateNote(candidatId: string, note: number) {
    await fetch(`/api/recrutement/candidats/${candidatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteGlobale: note }),
    })
    setCandidats(p => p.map(c => c.id === candidatId ? { ...c, noteGlobale: note } : c))
    if (selected?.id === candidatId) setSelected(s => s ? { ...s, noteGlobale: note } : s)
  }

  async function deleteCandidat(candidatId: string) {
    if (!confirm("Supprimer ce candidat ?")) return
    await fetch(`/api/recrutement/candidats/${candidatId}`, { method: "DELETE" })
    setCandidats(p => p.filter(c => c.id !== candidatId))
    if (selected?.id === candidatId) setSelected(null)
  }

  function getCurrentPipelineIndex(statut: string) { return PIPELINE.findIndex(p => p.key === statut) }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>
  if (!offre)  return <div className="p-8 text-slate-400">Offre introuvable</div>

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/recrutement" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mt-1.5 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{offre.titre}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUT_COLORS[offre.statut] ?? "bg-slate-100 text-slate-500"}`}>{offre.statut}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${PRIORITE_COLORS[offre.priorite] ?? "bg-slate-100 text-slate-500"}`}>{offre.priorite}</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{candidats.length} candidat(s)</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={openEdit}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Ajouter candidat</span><span className="sm:hidden">Candidat</span>
          </button>
        </div>
      </div>

      {/* Détail de l'offre */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Détails de l'offre</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Briefcase className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Type de contrat</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{offre.typeContrat}</p>
              </div>
            </div>
            {offre.departement && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Tag className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Département</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{offre.departement}</p>
                </div>
              </div>
            )}
            {offre.localisation && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Localisation</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{offre.localisation}</p>
                </div>
              </div>
            )}
            {offre.salaireFourchette && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Fourchette salariale</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-0.5">{offre.salaireFourchette}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Date d'ouverture</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmt(offre.dateOuverture)}</p>
              </div>
            </div>
            {offre.dateCloture && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Date de clôture</p>
                  <p className="text-sm font-semibold text-amber-700 mt-0.5">{fmt(offre.dateCloture)}</p>
                </div>
              </div>
            )}
            {!offre.departement && !offre.localisation && !offre.salaireFourchette && !offre.dateCloture && (
              <div className="sm:col-span-2 lg:col-span-1 flex items-center gap-2 text-xs text-slate-400">
                <AlertCircle className="h-3.5 w-3.5" /> Informations incomplètes — modifiez l'offre pour compléter.
              </div>
            )}
          </div>
          {offre.description && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-2">Description du poste</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{offre.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Formulaire modification offre */}
      {showEdit && (
        <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-500" /> Modifier l'offre
            </h2>
            <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Intitulé du poste *</label>
                <input required value={editForm.titre} onChange={e => ef("titre", e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {([
                { key: "departement" as const,       label: "Département",       placeholder: "RH, Finance..." },
                { key: "localisation" as const,      label: "Localisation",      placeholder: "Douala, Yaoundé..." },
                { key: "salaireFourchette" as const, label: "Fourchette salaire", placeholder: "150 000 – 250 000 FCFA" },
              ]).map(fi => (
                <div key={fi.key}>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi.label}</label>
                  <input value={editForm[fi.key]} onChange={e => ef(fi.key, e.target.value)} placeholder={fi.placeholder}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              ))}
              {([
                { key: "typeContrat" as const, label: "Contrat",  opts: ["CDI","CDD","STAGE","ALTERNANCE","FREELANCE","INTERIM"] },
                { key: "priorite"    as const, label: "Priorité", opts: [...PRIORITE] },
                { key: "statut"      as const, label: "Statut",   opts: [...STATUT_OFFRE] },
              ]).map(fi => (
                <div key={fi.key}>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi.label}</label>
                  <select value={editForm[fi.key]} onChange={e => ef(fi.key, e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {fi.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Date de clôture</label>
                <input type="date" value={editForm.dateCloture} onChange={e => ef("dateCloture", e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Description</label>
                <textarea rows={4} value={editForm.description} onChange={e => ef("description", e.target.value)}
                  placeholder="Missions, profil recherché, avantages..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEdit(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={savingEdit}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Formulaire ajout candidat */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Nouveau candidat</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4 text-slate-400" /></button>
          </div>
          <form onSubmit={addCandidat} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "prenom",    label: "Prénom *",   req: true,  placeholder: "Marie"          },
              { key: "nom",       label: "Nom *",      req: true,  placeholder: "Dupont"         },
              { key: "email",     label: "Email",      req: false, placeholder: "marie@email.com" },
              { key: "telephone", label: "Téléphone",  req: false, placeholder: "+237 6XX XXX XXX" },
            ].map(fi => (
              <div key={fi.key}>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">{fi.label}</label>
                <input required={fi.req} value={form[fi.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [fi.key]: e.target.value }))} placeholder={fi.placeholder}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Source</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">Sélectionner...</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Commentaire initial</label>
              <textarea rows={2} value={form.commentaire} onChange={e => setForm(p => ({ ...p, commentaire: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pipeline kanban */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Pipeline candidats</h2>
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="flex gap-3" style={{ minWidth: "900px" }}>
            {PIPELINE.map(col => {
              const colCandidats = candidats.filter(c => c.statut === col.key)
              return (
                <div key={col.key} className="flex-1 min-w-0" style={{ minWidth: "130px" }}>
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: col.bg }}>
                      <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
                      <span className="text-xs font-black px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: col.color }}>{colCandidats.length}</span>
                    </div>
                    <div className="bg-slate-50 min-h-32 p-2 space-y-2">
                      {colCandidats.map(c => {
                        const idx = getCurrentPipelineIndex(c.statut)
                        return (
                          <div key={c.id}
                            className={`rounded-lg bg-white border p-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all ${selected?.id === c.id ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-200"}`}
                            onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                            <p className="text-xs font-bold text-slate-900 truncate">{c.prenom} {c.nom}</p>
                            {c.source && <p className="text-[10px] text-slate-400 mt-0.5">{SOURCE_LABELS[c.source] ?? c.source}</p>}
                            {c.noteGlobale && <StarRating value={c.noteGlobale} />}
                            <div className="flex items-center gap-1 mt-2">
                              <button disabled={idx <= 0} onClick={e => { e.stopPropagation(); moveCandidat(c.id, PIPELINE[idx-1].key) }}
                                className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20 transition-colors">
                                <ChevronLeft className="h-3 w-3 text-slate-400" />
                              </button>
                              <button disabled={idx >= PIPELINE.length - 1} onClick={e => { e.stopPropagation(); moveCandidat(c.id, PIPELINE[idx+1].key) }}
                                className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20 transition-colors">
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Panneau détail candidat */}
      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{selected.prenom} {selected.nom}</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {PIPELINE.find(p => p.key === selected.statut)?.label ?? selected.statut}
                {selected.source ? ` · via ${SOURCE_LABELS[selected.source] ?? selected.source}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4 text-slate-400" />
              </button>
              <button onClick={() => deleteCandidat(selected.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {selected.email     && <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" />{selected.email}</div>}
            {selected.telephone && <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" />{selected.telephone}</div>}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-1.5">Note globale</p>
            <StarRating value={selected.noteGlobale} onChange={n => updateNote(selected.id, n)} />
          </div>
          {selected.commentaire && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 text-sm text-slate-600">
              {selected.commentaire}
            </div>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Avancer dans le pipeline</p>
            <div className="flex flex-wrap gap-2">
              {PIPELINE.map(p => (
                <button key={p.key} onClick={() => moveCandidat(selected.id, p.key)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${selected.statut === p.key ? "text-white" : "hover:opacity-80"}`}
                  style={{ backgroundColor: selected.statut === p.key ? p.color : p.bg, color: selected.statut === p.key ? "white" : p.color, border: `1px solid ${p.color}20` }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
