"use client"

import { useEffect, useState } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Pencil, Check, X, Phone, MapPin, Mail, AlertCircle, Loader2, UserCheck } from "lucide-react"

type Employe = {
  id: string; prenom: string; nom: string; email: string | null; telephone: string | null
  poste: string; departement: string | null; typeContrat: string; dateEmbauche: string
  dateFinContrat: string | null; periodeEssai: boolean; dateFinEssai: string | null
  dateDebutEssai: string | null; salaireBase: number; statut: string; matricule: string
  nationalite: string | null; adresse: string | null; photoUrl: string | null
  dateNaissance: string | null; lieuNaissance: string | null; numeroCni: string | null
  notes: string | null; contactUrgenceNom: string | null; contactUrgenceTel: string | null
}

export default function MonProfilPage() {
  const [employe, setEmploye] = useState<Employe | null>(null)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({ telephone: "", adresse: "", email: "", contactUrgenceNom: "", contactUrgenceTel: "" })

  useEffect(() => {
    fetch("/api/mon-espace/profil")
      .then(r => r.json())
      .then(d => {
        const e: Employe = d.employe
        setEmploye(e)
        setForm({
          telephone:         e.telephone         ?? "",
          adresse:           e.adresse           ?? "",
          email:             e.email             ?? "",
          contactUrgenceNom: e.contactUrgenceNom ?? "",
          contactUrgenceTel: e.contactUrgenceTel ?? "",
        })
      })
      .finally(() => setLoading(false))
  }, [])

  function startEdit() { setEditing(true); setSaved(false); setError(null) }
  function cancelEdit() {
    if (!employe) return
    setForm({ telephone: employe.telephone ?? "", adresse: employe.adresse ?? "", email: employe.email ?? "", contactUrgenceNom: employe.contactUrgenceNom ?? "", contactUrgenceTel: employe.contactUrgenceTel ?? "" })
    setEditing(false)
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/mon-espace/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).message ?? "Erreur")
      const data = await res.json()
      setEmploye(prev => prev ? { ...prev, telephone: data.employe.telephone, adresse: data.employe.adresse, email: data.employe.email, contactUrgenceNom: data.employe.contactUrgenceNom, contactUrgenceTel: data.employe.contactUrgenceTel } : prev)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )
  if (!employe) return null

  const contact = { nom: employe.contactUrgenceNom ?? "", tel: employe.contactUrgenceTel ?? "" }

  const proBadge = employe.statut === "ACTIF"
    ? "bg-green-100 text-green-700"
    : employe.statut === "SUSPENDU" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>
          <p className="text-sm text-slate-500 mt-1">Vos informations personnelles et professionnelles</p>
        </div>
        {!editing ? (
          <button onClick={startEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Pencil className="h-4 w-4" /> Modifier
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 text-sm hover:bg-slate-50 transition-colors">
              <X className="h-4 w-4" /> Annuler
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <UserCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">Profil mis à jour avec succès</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #064e3b, #065f46)" }}>
        <div className="px-6 py-6 flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
            {employe.prenom[0]}{employe.nom[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{employe.prenom} {employe.nom}</h2>
            <p className="text-emerald-200 text-sm">{employe.poste}{employe.departement ? ` · ${employe.departement}` : ""}</p>
            <p className="text-emerald-300 text-xs mt-0.5">Matricule {employe.matricule}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
          {[
            { label: "Contrat",  value: employe.typeContrat },
            { label: "Embauche", value: formatDate(employe.dateEmbauche) },
            { label: "Salaire",  value: formatCurrency(employe.salaireBase) },
            { label: "Statut",   value: employe.statut },
          ].map((s, i) => (
            <div key={i} className="px-4 py-3 border-r border-white/10 last:border-0 even:border-r-0 sm:even:border-r border-b sm:border-b-0">
              <p className="text-emerald-400 text-xs">{s.label}</p>
              <p className="text-white font-semibold text-sm mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Informations professionnelles (lecture seule) */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-slate-900 text-sm">Informations professionnelles</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${proBadge}`}>{employe.statut}</span>
        </div>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Matricule",       value: employe.matricule },
            { label: "Poste",           value: employe.poste },
            { label: "Département",     value: employe.departement },
            { label: "Type de contrat", value: employe.typeContrat },
            { label: "Date d'embauche", value: formatDate(employe.dateEmbauche) },
            { label: "Fin de contrat",  value: employe.dateFinContrat ? formatDate(employe.dateFinContrat) : "Indéterminé" },
          ].filter(r => r.value).map(row => (
            <div key={row.label}>
              <p className="text-xs text-slate-400 mb-0.5">{row.label}</p>
              <p className="text-sm font-medium text-slate-800">{row.value}</p>
            </div>
          ))}
        </div>
        <p className="px-6 pb-4 text-xs text-slate-400">Ces informations sont gérées par votre service RH.</p>
      </div>

      {/* Informations personnelles (éditable) */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <p className="font-semibold text-slate-900 text-sm">Coordonnées personnelles</p>
          {editing && <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">En cours de modification</span>}
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "telephone", label: "Téléphone", icon: Phone,  placeholder: "06 12 34 56 78", type: "tel"  },
            { key: "adresse",   label: "Adresse",   icon: MapPin, placeholder: "12 rue de la Paix, 75001 Paris", type: "text" },
            { key: "email",     label: "Email",     icon: Mail,   placeholder: "prenom.nom@email.com", type: "email" },
          ].map(({ key, label, icon: Icon, placeholder, type }) => (
            <div key={key} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                {editing ? (
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-800">
                    {(employe[key as keyof Employe] as string) || <span className="text-slate-400 font-normal italic">Non renseigné</span>}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact d'urgence */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Contact en cas d'urgence</p>
        </div>
        <div className="p-6">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Nom du contact</p>
                <input type="text" value={form.contactUrgenceNom}
                  onChange={e => setForm(f => ({ ...f, contactUrgenceNom: e.target.value }))}
                  placeholder="Marie Dupont"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Téléphone du contact</p>
                <input type="tel" value={form.contactUrgenceTel}
                  onChange={e => setForm(f => ({ ...f, contactUrgenceTel: e.target.value }))}
                  placeholder="06 98 76 54 32"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>
            </div>
          ) : (
            contact.nom ? (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center font-semibold text-amber-700 text-sm flex-shrink-0">
                  {contact.nom[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{contact.nom}</p>
                  {contact.tel && <p className="text-xs text-slate-500">{contact.tel}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Non renseigné — cliquez sur Modifier pour ajouter un contact d'urgence</p>
            )
          )}
        </div>
      </div>

      {/* Infos identité (lecture seule) */}
      {(employe.dateNaissance || employe.nationalite || employe.numeroCni) && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">Identité</p>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: "Date de naissance", value: employe.dateNaissance ? formatDate(employe.dateNaissance) : null },
              { label: "Lieu de naissance", value: employe.lieuNaissance },
              { label: "Nationalité",       value: employe.nationalite   },
              { label: "N° CNI / Passeport",value: employe.numeroCni     },
            ].filter(r => r.value).map(row => (
              <div key={row.label}>
                <p className="text-xs text-slate-400 mb-0.5">{row.label}</p>
                <p className="text-sm font-medium text-slate-800">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {employe.periodeEssai && employe.dateFinEssai && (() => {
        const fin = new Date(employe.dateFinEssai!)
        const now = new Date()
        const j   = Math.ceil((fin.getTime() - now.getTime()) / 86400000)
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900 text-sm mb-2">Période d'essai</p>
            <p className="text-sm text-amber-800">
              {now < fin ? `En cours — ${j} jour(s) restant(s) (fin le ${formatDate(employe.dateFinEssai!)})` : "Terminée"}
            </p>
          </div>
        )
      })()}
    </div>
  )
}
