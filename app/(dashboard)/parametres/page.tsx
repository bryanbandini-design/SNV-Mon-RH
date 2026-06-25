"use client"

import { useState, useEffect } from "react"
import { Settings, Building2, DollarSign, Check, Loader2, AlertCircle, Calendar, Info, KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { CAMEROUN } from "@/lib/cameroun-salaire"

type Params = Record<string, string>

const ENTREPRISE_FIELDS = [
  { key: "ENTREPRISE_NOM",       label: "Nom de l'entreprise",      type: "text",   placeholder: "SARL Mon Entreprise" },
  { key: "ENTREPRISE_ADRESSE",   label: "Adresse complète",          type: "text",   placeholder: "Rue Njo Njo, Bonanjo, Douala" },
  { key: "ENTREPRISE_RCCM",      label: "N° RCCM",                   type: "text",   placeholder: "RC/DLA/2024/B/1234" },
  { key: "ENTREPRISE_NIU",       label: "NIU (Numéro Identifiant Unique)", type: "text", placeholder: "M123456789" },
  { key: "ENTREPRISE_TEL",       label: "Téléphone",                  type: "text",   placeholder: "+237 6XX XXX XXX" },
  { key: "ENTREPRISE_EMAIL",     label: "Email",                      type: "email",  placeholder: "contact@entreprise.cm" },
  { key: "ENTREPRISE_DIRIGEANT", label: "Dirigeant signataire",       type: "text",   placeholder: "M. Jean-Paul Mbarga, DG" },
]

const RH_FIELDS = [
  { key: "CONGES_ANNUELS_DEFAUT", label: "Congés annuels par défaut (jours)", type: "number", placeholder: "24" },
]

export default function ParametresPage() {
  const [params, setParams] = useState<Params>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // ── Changement de mot de passe ──────────────────────────────────────────
  const [pwdCurrent, setPwdCurrent] = useState("")
  const [pwdNew,     setPwdNew]     = useState("")
  const [pwdConfirm, setPwdConfirm] = useState("")
  const [showPwd,    setShowPwd]    = useState(false)
  const [pwdSaving,  setPwdSaving]  = useState(false)
  const [pwdOk,      setPwdOk]      = useState(false)
  const [pwdError,   setPwdError]   = useState<string | null>(null)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null); setPwdOk(false)
    if (pwdNew !== pwdConfirm) { setPwdError("Les mots de passe ne correspondent pas"); return }
    if (pwdNew.length < 8)     { setPwdError("Minimum 8 caractères requis"); return }
    setPwdSaving(true)
    try {
      const res = await fetch("/api/mon-compte/password", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
      })
      const d = await res.json()
      if (!res.ok) { setPwdError(d.message ?? "Erreur"); return }
      setPwdOk(true)
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("")
      setTimeout(() => setPwdOk(false), 4000)
    } catch { setPwdError("Erreur réseau") }
    finally { setPwdSaving(false) }
  }

  useEffect(() => {
    fetch("/api/parametres").then(r => r.json()).then(d => {
      setParams(d.params ?? {})
      setLoading(false)
    })
  }, [])

  function set(key: string, val: string) { setParams(p => ({ ...p, [key]: val })) }

  async function save() {
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await fetch("/api/parametres", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(params),
      })
      if (!res.ok) throw new Error("Erreur lors de l'enregistrement")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
          <p className="text-sm text-slate-500 mt-1">Configuration entreprise — Droit camerounais</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Enregistrer
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">Paramètres enregistrés avec succès</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Informations entreprise */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
            <Building2 className="h-4 w-4" />
          </div>
          <p className="font-semibold text-slate-900 text-sm">Informations de l'entreprise</p>
        </div>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ENTREPRISE_FIELDS.map(f => (
            <div key={f.key} className={f.key === "ENTREPRISE_NOM" || f.key === "ENTREPRISE_ADRESSE" ? "sm:col-span-2" : ""}>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">{f.label}</label>
              <input
                type={f.type}
                value={params[f.key] ?? ""}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Paramètres RH */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
            <Calendar className="h-4 w-4" />
          </div>
          <p className="font-semibold text-slate-900 text-sm">Paramètres RH</p>
        </div>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {RH_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-slate-500 font-medium block mb-1.5">{f.label}</label>
              <input
                type={f.type}
                step="1"
                value={params[f.key] ?? ""}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Barème légal Cameroun — lecture seule */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50">
        <div className="px-6 py-4 border-b border-emerald-200 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-600">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-emerald-900 text-sm">Barème légal camerounais — appliqué automatiquement</p>
            <p className="text-xs text-emerald-700">Sources : CNPS, DGI Cameroun, Code du Travail</p>
          </div>
        </div>
        <div className="p-6 space-y-5">

          {/* CNPS salarié */}
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-2">CNPS — Cotisations salariales</p>
            <div className="bg-white rounded-lg border border-emerald-100 divide-y divide-slate-100 text-sm">
              {[
                { label: "Vieillesse / Invalidité / Décès (salarié)", taux: `${(CAMEROUN.CNPS_VIEILLESSE_SAL * 100).toFixed(1)} %` },
                { label: `Plafond mensuel de cotisation`, taux: `${CAMEROUN.CNPS_PLAFOND_MENSUEL.toLocaleString("fr-FR")} FCFA` },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{r.taux}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CNPS patronal */}
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-2">CNPS — Charges patronales</p>
            <div className="bg-white rounded-lg border border-emerald-100 divide-y divide-slate-100 text-sm">
              {[
                { label: "Vieillesse patronal", taux: `${(CAMEROUN.CNPS_VIEILLESSE_PAT * 100).toFixed(1)} %` },
                { label: "Allocations familiales", taux: `${(CAMEROUN.CNPS_ALLOC_FAM_PAT * 100).toFixed(1)} %` },
                { label: "Accidents du Travail / Maladies Professionnelles", taux: `${(CAMEROUN.CNPS_AT_MP_PAT * 100).toFixed(1)} %` },
                { label: "TOTAL charges patronales CNPS", taux: `${((CAMEROUN.CNPS_VIEILLESSE_PAT + CAMEROUN.CNPS_ALLOC_FAM_PAT + CAMEROUN.CNPS_AT_MP_PAT) * 100).toFixed(1)} %` },
              ].map(r => (
                <div key={r.label} className={`flex justify-between px-4 py-2.5 ${r.label.startsWith("TOTAL") ? "bg-emerald-50 font-semibold" : ""}`}>
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{r.taux}</span>
                </div>
              ))}
            </div>
          </div>

          {/* IRPP */}
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-2">IRPP — Impôt sur le Revenu des Personnes Physiques (mensuel)</p>
            <div className="bg-white rounded-lg border border-emerald-100 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                <span>Tranche (base mensuelle)</span><span>Taux</span>
              </div>
              {CAMEROUN.IRPP_TRANCHES.map((t, i) => (
                <div key={i} className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-600">
                    {t.min.toLocaleString("fr-FR")} – {t.max === Infinity ? "∞" : t.max.toLocaleString("fr-FR")} FCFA
                  </span>
                  <span className="font-semibold text-slate-900">{(t.taux * 100).toFixed(0)} %</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 bg-slate-50">
                <span className="text-slate-600">Abattement forfaitaire (30%, plafonné)</span>
                <span className="font-semibold text-slate-900">{CAMEROUN.IRPP_ABATTEMENT_PLAFOND.toLocaleString("fr-FR")} FCFA/mois max</span>
              </div>
            </div>
          </div>

          {/* CAC + RAV + SMIG */}
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-2">Autres contributions</p>
            <div className="bg-white rounded-lg border border-emerald-100 divide-y divide-slate-100 text-sm">
              {[
                { label: "CAC — Centimes Additionnels Communaux (% de l'IRPP)", taux: `${(CAMEROUN.CAC_TAUX * 100).toFixed(0)} %` },
                { label: "RAV — Redevance Audiovisuelle (forfait mensuel)", taux: `${CAMEROUN.RAV_MENSUEL.toLocaleString("fr-FR")} FCFA` },
                { label: "SMIG en vigueur", taux: `${CAMEROUN.SMIG.toLocaleString("fr-FR")} FCFA/mois` },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{r.taux}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-100 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <p>Ces taux sont définis par la loi camerounaise et appliqués automatiquement sur tous les bulletins de paie. Ils ne peuvent pas être modifiés ici — toute modification légale doit être faite dans <code className="bg-emerald-200 px-1 rounded">/lib/cameroun-salaire.ts</code>.</p>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex items-start gap-3">
        <Settings className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Ces paramètres sont utilisés dans</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            <li>• Les <strong>attestations PDF</strong> (nom entreprise, RCCM, NIU, dirigeant)</li>
            <li>• Les <strong>bulletins de paie</strong> (en-tête employeur, pied de page légal)</li>
            <li>• La <strong>création d'employés</strong> (solde congés par défaut)</li>
          </ul>
        </div>
      </div>

      {/* ── Changer mon mot de passe ── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Changer mon mot de passe</p>
            <p className="text-xs text-slate-500">Modifiez le mot de passe de votre compte</p>
          </div>
        </div>
        <form onSubmit={changePassword} className="p-6 space-y-4 max-w-md">
          {pwdError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{pwdError}</p>
            </div>
          )}
          {pwdOk && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700 font-medium">Mot de passe mis à jour avec succès !</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Mot de passe actuel</label>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={pwdCurrent}
                onChange={e => setPwdCurrent(e.target.value)} required
                placeholder="••••••••"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Nouveau mot de passe</label>
            <input type={showPwd ? "text" : "password"} value={pwdNew}
              onChange={e => setPwdNew(e.target.value)} required
              placeholder="Min. 8 caractères"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Confirmer le nouveau mot de passe</label>
            <input type={showPwd ? "text" : "password"} value={pwdConfirm}
              onChange={e => setPwdConfirm(e.target.value)} required
              placeholder="Retaper le mot de passe"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          <button type="submit" disabled={pwdSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60">
            {pwdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Changer le mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}
