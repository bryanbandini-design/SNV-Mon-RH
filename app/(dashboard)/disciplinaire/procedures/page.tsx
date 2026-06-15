"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Plus, AlertTriangle, Loader2, ShieldOff, CheckCircle,
  FileText, Upload, Clock, ChevronRight, Download, Send,
  TriangleAlert, FileScan, Bell, X, RefreshCw,
} from "lucide-react"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, TYPES_DISCIPLINAIRE } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type Employe = { id: string; prenom: string; nom: string; matricule: string }

type Document = {
  id: string; nom: string; type: string; url: string; taille: number | null; createdAt: string
}

type Dossier = {
  id: string
  type: string
  date: string
  motif: string
  description: string
  statut: string
  sanctions:              string | null
  suites:                 string | null
  initiePar:              string | null
  delaiReponseJours:      number
  dateEnvoiDocument:      string | null
  dateEnvoiEmploye:       string | null
  dateReponseAttendue:    string | null
  dateReponseReelle:      string | null
  statutReponse:          string | null
  sanctionAutoAppliquee:  boolean
  sanctionAutoRef:        string | null
  employe:   { prenom: string; nom: string; matricule: string }
  initiateur: { name: string } | null
  documents:  Document[]
}

// ─── Config visuelle ──────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DEMANDE_EXPLICATION: { label: "Demande d'explication", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  AVERTISSEMENT:       { label: "Avertissement",         color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  BLAME:               { label: "Blâme",                 color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  MISE_EN_DEMEURE:     { label: "Mise en demeure",       color: "#b91c1c", bg: "#fee2e2", border: "#f87171" },
  MISE_A_PIED:         { label: "Mise à pied",           color: "#991b1b", bg: "#fef2f2", border: "#ef4444" },
  LICENCIEMENT:        { label: "Licenciement",          color: "#7f1d1d", bg: "#450a0a", border: "#dc2626" },
}

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  INITIE:          { label: "Initié",                  color: "#3b82f6", bg: "#eff6ff" },
  DOCUMENT_PRET:   { label: "Document prêt",           color: "#8b5cf6", bg: "#f5f3ff" },
  EN_ATTENTE_REP:  { label: "En attente de réponse",   color: "#d97706", bg: "#fffbeb" },
  REPONSE_RECUE:   { label: "Réponse reçue",           color: "#059669", bg: "#ecfdf5" },
  SANCTION_AUTO:   { label: "Sanction automatique",    color: "#dc2626", bg: "#fef2f2" },
  CLOS:            { label: "Clos",                    color: "#64748b", bg: "#f8fafc" },
}

function statutCfg(s: string) {
  return STATUT_CFG[s] ?? { label: s, color: "#64748b", bg: "#f1f5f9" }
}
function typeCfg(t: string) {
  return TYPE_CFG[t] ?? TYPE_CFG.AVERTISSEMENT
}

function joursRestants(dateAttendue: string | null): number | null {
  if (!dateAttendue) return null
  return Math.ceil((new Date(dateAttendue).getTime() - Date.now()) / 86400000)
}

function formatBytes(n: number | null) {
  if (!n) return ""
  if (n < 1024)       return `${n} o`
  if (n < 1024 * 1024) return `${(n/1024).toFixed(0)} Ko`
  return `${(n/1024/1024).toFixed(1)} Mo`
}

// ─── Composants atomiques ─────────────────────────────────────────────────────

function Avatar({ nom, prenom, color, bg }: { nom: string; prenom: string; color: string; bg: string }) {
  return (
    <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: bg, color }}>
      {prenom[0]}{nom[0]}
    </div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg = statutCfg(statut)
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function DelaiBar({ dateAttendue }: { dateAttendue: string | null }) {
  const jours = joursRestants(dateAttendue)
  if (jours === null) return null
  const urgent = jours <= 1
  const warning = jours <= 3
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${urgent ? "text-red-600" : warning ? "text-amber-600" : "text-slate-500"}`}>
      <Clock className="h-3.5 w-3.5" />
      {jours <= 0
        ? "Délai dépassé"
        : `${jours} jour(s) restant(s) · échéance ${formatDate(dateAttendue)}`}
    </div>
  )
}

// ─── Upload inline ─────────────────────────────────────────────────────────────

function UploadBtn({
  dossierId, typeDoc, label, onDone, accept = "*",
}: {
  dossierId: string; typeDoc: string; label: string
  onDone: (doc: Document) => void; accept?: string
}) {
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("dossierId", dossierId)
    fd.append("type", typeDoc)
    const r = await fetch("/api/upload", { method: "POST", body: fd })
    if (r.ok) {
      const doc = await r.json()
      onDone(doc)
      toast.success(`${label} uploadé avec succès`)
    } else {
      toast.error("Erreur lors de l'upload")
    }
    setLoading(false)
    if (ref.current) ref.current.value = ""
  }

  return (
    <>
      <input ref={ref} type="file" className="hidden" accept={accept} onChange={handleFile} />
      <button
        onClick={() => ref.current?.click()}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {loading ? "Envoi…" : label}
      </button>
    </>
  )
}

// ─── Carte dossier ─────────────────────────────────────────────────────────────

function DossierCard({
  d, role, userId, onUpdate,
}: {
  d: Dossier; role: string; userId: string
  onUpdate: (id: string, changes: Partial<Dossier>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [cloturing, setCloturing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const cfg     = typeCfg(d.type)
  const isClos  = d.statut === "CLOS"
  const isRH    = role === "RH" || role === "ADMIN"
  const isResp  = role === "RESPONSABLE" || role === "ADMIN"

  async function confirmerEnvoi() {
    setConfirming(true)
    const r = await fetch(`/api/disciplinaire/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ENVOYE_EMPLOYE" }),
    })
    if (r.ok) {
      const updated = await r.json()
      onUpdate(d.id, updated)
      toast.success("Transmission confirmée — délai de réponse enclenché")
    } else { toast.error("Erreur") }
    setConfirming(false)
  }

  async function clore() {
    setCloturing(true)
    const r = await fetch(`/api/disciplinaire/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CLORE" }),
    })
    if (r.ok) {
      onUpdate(d.id, { statut: "CLOS" })
      toast.success("Dossier clôturé")
    } else { toast.error("Erreur") }
    setCloturing(false)
  }

  const docRH       = d.documents.find(doc => doc.type === "DOCUMENT_RH")
  const docReponse  = d.documents.find(doc => doc.type === "REPONSE_EMPLOYE")
  const jours       = joursRestants(d.dateReponseAttendue)
  const delaiDepasse = jours !== null && jours < 0

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-all ${isClos ? "opacity-60" : ""}`}
      style={{ borderColor: cfg.border, borderLeftWidth: "4px", borderLeftColor: cfg.color }}
    >
      {/* ── En-tête cliquable ─────── */}
      <button
        className="w-full p-5 flex items-start justify-between gap-4 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar prenom={d.employe.prenom} nom={d.employe.nom} color={cfg.color} bg={cfg.bg} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm">{d.employe.prenom} {d.employe.nom}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              <StatutBadge statut={d.statut} />
              {d.sanctionAutoAppliquee && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3" /> Sanction auto
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{d.motif}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDate(d.date)} · initié par {d.initiateur?.name ?? "—"}
            </p>
            {d.statut === "EN_ATTENTE_REP" && <DelaiBar dateAttendue={d.dateReponseAttendue} />}
            {d.statutReponse === "HORS_DELAI" && (
              <span className="text-xs text-red-600 font-semibold">Réponse hors délai</span>
            )}
            {d.statutReponse === "DANS_DELAI" && (
              <span className="text-xs text-emerald-600 font-semibold">Réponse dans les délais — prioritaire</span>
            )}
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {/* ── Détail dépliable ─────── */}
      <div className={`transition-all duration-300 overflow-hidden ${expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">

          {/* Description */}
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">{d.description}</p>

          {/* Documents */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</p>
            <div className="flex flex-wrap gap-2">
              {docRH && (
                <a href={`/api/files/${docRH.url}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                  {docRH.nom} {docRH.taille ? `(${formatBytes(docRH.taille)})` : ""}
                  <Download className="h-3 w-3 ml-0.5" />
                </a>
              )}
              {docReponse && (
                <a href={`/api/files/${docReponse.url}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                  <FileScan className="h-3.5 w-3.5" />
                  Réponse scannée · {formatDate(d.dateReponseReelle)}
                  <Download className="h-3 w-3 ml-0.5" />
                </a>
              )}
              {!docRH && !docReponse && (
                <p className="text-xs text-slate-400">Aucun document pour le moment</p>
              )}
            </div>
          </div>

          {/* ── Actions RH ──────────────────────────────── */}
          {isRH && !isClos && (
            <div className="flex items-center gap-2 flex-wrap">
              {d.statut === "INITIE" && (
                <UploadBtn
                  dossierId={d.id} typeDoc="DOCUMENT_RH" label="Uploader le document RH"
                  accept=".pdf,.doc,.docx"
                  onDone={(doc) => onUpdate(d.id, { statut: "DOCUMENT_PRET", documents: [...d.documents, doc] })}
                />
              )}
              {(d.statut === "REPONSE_RECUE") && (
                <button onClick={clore} disabled={cloturing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60 transition-colors">
                  {cloturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  Clore le dossier
                </button>
              )}
              {d.statut !== "INITIE" && d.statut !== "CLOS" && (
                <button onClick={clore} disabled={cloturing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors">
                  {cloturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Forcer la clôture
                </button>
              )}
            </div>
          )}

          {/* ── Actions RESPONSABLE ─────────────────────── */}
          {isResp && !isClos && (
            <div className="flex items-center gap-2 flex-wrap">
              {d.statut === "DOCUMENT_PRET" && (
                <>
                  {docRH && (
                    <a href={`/api/files/${docRH.url}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                      <Download className="h-3.5 w-3.5" />
                      Télécharger le document
                    </a>
                  )}
                  <button onClick={confirmerEnvoi} disabled={confirming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors">
                    {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Confirmer la transmission à l&apos;employé
                  </button>
                </>
              )}
              {d.statut === "EN_ATTENTE_REP" && !delaiDepasse && (
                <UploadBtn
                  dossierId={d.id} typeDoc="REPONSE_EMPLOYE" label="Scanner & uploader la réponse"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onDone={(doc) => onUpdate(d.id, {
                    statut: "REPONSE_RECUE",
                    dateReponseReelle: new Date().toISOString(),
                    documents: [...d.documents, doc],
                  })}
                />
              )}
              {d.statut === "EN_ATTENTE_REP" && delaiDepasse && (
                <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Délai dépassé — une sanction sera automatiquement appliquée lors de l&apos;envoi de la réponse
                </div>
              )}
            </div>
          )}

          {/* ── Infos délai ─────────────────────────────── */}
          {d.type === "DEMANDE_EXPLICATION" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              <div><p className="font-semibold text-slate-700">Délai accordé</p><p>{d.delaiReponseJours} jours</p></div>
              <div><p className="font-semibold text-slate-700">Date limite</p><p>{formatDate(d.dateReponseAttendue) || "—"}</p></div>
              <div><p className="font-semibold text-slate-700">Réponse reçue</p><p>{formatDate(d.dateReponseReelle) || "—"}</p></div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function DisciplinairePage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role   = (session?.user as any)?.role   ?? "RH"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id      ?? ""

  const [dossiers,  setDossiers]  = useState<Dossier[]>([])
  const [employes,  setEmployes]  = useState<Employe[]>([])
  const [showForm,  setShowForm]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [onglet,    setOnglet]    = useState<"actifs" | "clos">("actifs")
  const [form, setForm] = useState({
    employeId: "", type: "", date: "", motif: "", description: "",
    sanctions: "", suites: "", delaiReponseJours: "5",
  })

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/disciplinaire").then(r => r.ok ? r.json() : []),
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
    ]).then(([d, e]) => {
      if (Array.isArray(d)) setDossiers(d)
      if (Array.isArray(e)) setEmployes(e)
    })
  }, [])

  useEffect(() => { load() }, [load])

  function onUpdate(id: string, changes: Partial<Dossier>) {
    setDossiers(prev => prev.map(d => d.id === id ? { ...d, ...changes } : d))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const r = await fetch("/api/disciplinaire", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    })
    if (r.ok) {
      toast.success("Demande disciplinaire soumise au RH")
      setShowForm(false)
      setForm({ employeId: "", type: "", date: "", motif: "", description: "", sanctions: "", suites: "", delaiReponseJours: "5" })
      load()
    } else {
      toast.error("Erreur lors de la soumission")
    }
    setLoading(false)
  }

  const actifs = dossiers.filter(d => d.statut !== "CLOS")
  const clos   = dossiers.filter(d => d.statut === "CLOS")

  // Compteurs d'actions en attente (ADMIN cumule les deux côtés)
  const aTraiterRH   = actifs.filter(d => d.statut === "INITIE" || d.statut === "REPONSE_RECUE").length
  const aTraiterResp = actifs.filter(d => d.statut === "DOCUMENT_PRET" || d.statut === "EN_ATTENTE_REP").length
  const aTraiter = role === "ADMIN"
    ? aTraiterRH + aTraiterResp
    : role === "RH"
      ? aTraiterRH
      : aTraiterResp

  const liste = onglet === "actifs" ? actifs : clos

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dossiers Disciplinaires</h1>
          <p className="text-sm mt-1 text-slate-500">
            Vue{" "}
          <span className="font-semibold" style={{ color: role === "ADMIN" ? "#7c3aed" : role === "RH" ? "#3b82f6" : "#d97706" }}>
            {role === "ADMIN" ? "Administrateur" : role}
          </span>
            {aTraiter > 0 && (
              <span className="ml-2 text-red-600 font-medium">· {aTraiter} action(s) en attente</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle demande
          </button>
        </div>
      </div>

      {/* ── Formulaire ─────────────────────────────────────────────────────── */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-red-200 bg-red-50/30 p-6">
          <h2 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Ouvrir une procédure disciplinaire
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Employé *</Label>
              <Select value={form.employeId} onValueChange={v => setForm(p => ({ ...p, employeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{employes.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Type *</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {TYPES_DISCIPLINAIRE.map(t => (
                    <SelectItem key={t} value={t}>{TYPE_CFG[t]?.label ?? t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date des faits *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
            </div>
            {form.type === "DEMANDE_EXPLICATION" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Délai de réponse (jours)</Label>
                <Input type="number" min={1} max={30} value={form.delaiReponseJours}
                  onChange={e => setForm(p => ({ ...p, delaiReponseJours: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-slate-600">Motif *</Label>
              <Input value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))}
                placeholder="Résumé en une ligne" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-slate-600">Description des faits *</Label>
              <Textarea value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3} required placeholder="Décrivez les faits reprochés..." />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-slate-600">Sanctions envisagées</Label>
              <Textarea value={form.sanctions}
                onChange={e => setForm(p => ({ ...p, sanctions: e.target.value }))}
                rows={2} placeholder="Détail des sanctions..." />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">
                Annuler
              </button>
              <button type="submit"
                disabled={loading || !form.employeId || !form.type || !form.date || !form.motif}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#ef4444" }}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Soumettre la demande
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Guide workflow ──────────────────────────────────────────────────── */}
      {aTraiter > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Bell className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            {role === "ADMIN" ? (
              <>Vous avez <strong>{aTraiter}</strong> action(s) en attente. En tant qu&apos;administrateur vous pouvez tout gérer directement : uploader les documents, confirmer les transmissions, scanner les réponses.</>
            ) : role === "RH" ? (
              <>Vous avez <strong>{aTraiter}</strong> action(s) en attente : uploadez les documents RH pour les dossiers <em>Initiés</em>, ou évaluez les réponses reçues.</>
            ) : (
              <>Vous avez <strong>{aTraiter}</strong> action(s) en attente : téléchargez et transmettez les documents aux employés concernés, ou scannez les réponses reçues.</>
            )}
          </div>
        </div>
      )}

      {/* ── Onglets ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([["actifs", `Actifs (${actifs.length})`], ["clos", `Clos (${clos.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${onglet === id ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Liste ───────────────────────────────────────────────────────────── */}
      {liste.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ShieldOff className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-slate-500">
            {onglet === "actifs" ? "Aucun dossier actif" : "Aucun dossier clos"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {liste.map(d => (
            <DossierCard key={d.id} d={d} role={role} userId={userId} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
