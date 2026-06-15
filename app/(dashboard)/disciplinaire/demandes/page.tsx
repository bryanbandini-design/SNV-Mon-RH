"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Plus, Loader2, Clock, Upload, Download, Send, CheckCircle,
  TriangleAlert, FileScan, FileText, RefreshCw, ChevronRight,
  X, Bell, MessageSquare, History, Wrench, StickyNote,
  Trash2, PenLine, CheckCheck, XCircle, MinusCircle, AlertCircle,
} from "lucide-react"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type Employe = { id: string; prenom: string; nom: string; matricule: string }

type Document = {
  id: string; nom: string; type: string; url: string; taille: number | null; createdAt: string
}

type AuditLog = {
  id: string; type: string; description: string; auteurNom: string | null; createdAt: string
}

type NoteInterne = {
  id: string; auteurNom: string; contenu: string; createdAt: string
}

type Demande = {
  id: string; type: string; date: string; motif: string; description: string; statut: string
  categoriesFaits: string | null; niveauGravite: string | null; temoins: string | null
  delaiReponseJours: number
  dateEnvoiDocument: string | null; dateEnvoiEmploye: string | null
  dateReponseAttendue: string | null; dateReponseReelle: string | null
  statutReponse: string | null; sanctionAutoAppliquee: boolean; sanctionAutoRef: string | null
  modeRemise: string | null; dateRemiseEffective: string | null
  accuseReceptionUrl: string | null; refusReception: boolean; refusReceptionNote: string | null
  appreciationRH: string | null; decisionFinale: string | null
  sanctionRetenue: string | null; documentDecisionUrl: string | null
  dateNotificationDecision: string | null
  employe: { prenom: string; nom: string; matricule: string }
  initiateur: { name: string } | null
  documents: Document[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "RETARD", "ABSENCE", "INSUBORDINATION", "FAUTE_PRO", "COMPORTEMENT", "AUTRE"
]
const CATEGORIES_LABEL: Record<string, string> = {
  RETARD: "Retard répété", ABSENCE: "Absence injustifiée", INSUBORDINATION: "Insubordination",
  FAUTE_PRO: "Faute professionnelle", COMPORTEMENT: "Comportement inapproprié", AUTRE: "Autre",
}
const GRAVITES = ["FAIBLE", "MODERE", "ELEVE", "CRITIQUE"]
const GRAVITE_CFG: Record<string, { color: string; bg: string }> = {
  FAIBLE:   { color: "#2563eb", bg: "#eff6ff" },
  MODERE:   { color: "#d97706", bg: "#fffbeb" },
  ELEVE:    { color: "#dc2626", bg: "#fef2f2" },
  CRITIQUE: { color: "#7f1d1d", bg: "#fee2e2" },
}
const MODES_REMISE = ["EN_MAIN_PROPRE", "COURRIER_RECOMMANDE", "EMAIL"]
const MODES_LABEL: Record<string, string> = {
  EN_MAIN_PROPRE: "En main propre", COURRIER_RECOMMANDE: "Courrier recommandé", EMAIL: "Email",
}
const DECISION_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ACCEPTEE:               { label: "Acceptée — classement sans suite",    color: "#059669", bg: "#ecfdf5", icon: CheckCheck  },
  PARTIELLEMENT_ACCEPTEE: { label: "Partiellement acceptée",              color: "#d97706", bg: "#fffbeb", icon: MinusCircle },
  REJETEE:                { label: "Rejetée — sanction maintenue",        color: "#dc2626", bg: "#fef2f2", icon: XCircle     },
}
const STATUT_CFG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  INITIE:         { label: "En attente document RH",       color: "#3b82f6", bg: "#eff6ff", step: 1 },
  DOCUMENT_PRET:  { label: "Document prêt à transmettre",  color: "#8b5cf6", bg: "#f5f3ff", step: 2 },
  EN_ATTENTE_REP: { label: "En attente de réponse",        color: "#d97706", bg: "#fffbeb", step: 3 },
  REPONSE_RECUE:  { label: "Réponse reçue — à analyser",   color: "#059669", bg: "#ecfdf5", step: 4 },
  CLOS:           { label: "Clôturé",                      color: "#64748b", bg: "#f1f5f9", step: 5 },
}

const AUDIT_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  CREATION:      { icon: Plus,           color: "#3b82f6" },
  DOC_RH:        { icon: FileText,       color: "#8b5cf6" },
  TRANSMISSION:  { icon: Send,           color: "#f59e0b" },
  ACCUSE_RECU:   { icon: CheckCheck,     color: "#10b981" },
  REFUS_RECEPTION:{ icon: XCircle,       color: "#ef4444" },
  REPONSE:       { icon: FileScan,       color: "#06b6d4" },
  ANALYSE:       { icon: Wrench,         color: "#6366f1" },
  DECISION:      { icon: CheckCircle,    color: "#059669" },
  CLOTURE:       { icon: X,             color: "#64748b" },
  NOTE:          { icon: StickyNote,     color: "#a855f7" },
  SANCTION_AUTO: { icon: TriangleAlert,  color: "#dc2626" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function joursRestants(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function formatBytes(n: number | null) {
  if (!n) return ""
  if (n < 1024)        return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

// ─── Composant upload ─────────────────────────────────────────────────────────

function UploadBtn({ dossierId, typeDoc, label, onDone, accept = "*", className = "", modeRemise, dateRemise }: {
  dossierId: string; typeDoc: string; label: string; onDone: (doc: Document & { filename?: string }) => void
  accept?: string; className?: string; modeRemise?: string; dateRemise?: string
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
    if (modeRemise) fd.append("modeRemise", modeRemise)
    if (dateRemise) fd.append("dateRemise", dateRemise)
    const r = await fetch("/api/upload", { method: "POST", body: fd })
    if (r.ok) { const doc = await r.json(); onDone(doc); toast.success(`${label} uploadé`) }
    else toast.error("Erreur lors de l'upload")
    setLoading(false)
    if (ref.current) ref.current.value = ""
  }

  return (
    <>
      <input ref={ref} type="file" className="hidden" accept={accept} onChange={handleFile} />
      <button onClick={() => ref.current?.click()} disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 ${className}`}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {loading ? "Envoi…" : label}
      </button>
    </>
  )
}

// ─── Barre d'étapes ───────────────────────────────────────────────────────────

function StepBar({ statut }: { statut: string }) {
  const steps = [
    { key: "INITIE",         label: "Initiation",   step: 1 },
    { key: "DOCUMENT_PRET",  label: "Document RH",  step: 2 },
    { key: "EN_ATTENTE_REP", label: "Transmission", step: 3 },
    { key: "REPONSE_RECUE",  label: "Réponse",      step: 4 },
    { key: "CLOS",           label: "Analyse",      step: 5 },
  ]
  const current = STATUT_CFG[statut]?.step ?? 1
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done   = current > s.step
        const active = current === s.step
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                done   ? "bg-emerald-500 text-white" :
                active ? "bg-amber-500 text-white ring-2 ring-amber-200" :
                "bg-slate-200 text-slate-400"
              }`}>
                {done ? "✓" : s.step}
              </div>
              <span className={`text-[9px] mt-0.5 font-medium ${active ? "text-amber-600" : done ? "text-emerald-600" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 mb-3 ${done ? "bg-emerald-300" : "bg-slate-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Timeline (audit log) ─────────────────────────────────────────────────────

function Timeline({ dossierId }: { dossierId: string }) {
  const [logs,    setLogs]    = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/audit?dossierId=${dossierId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setLogs(d) })
      .finally(() => setLoading(false))
  }, [dossierId])

  if (loading) return <div className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-400" /></div>
  if (!logs.length) return <p className="text-xs text-slate-400 text-center py-4">Aucun événement enregistré</p>

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const cfg = AUDIT_ICON[log.type] ?? { icon: AlertCircle, color: "#94a3b8" }
        const Icon = cfg.icon
        return (
          <div key={log.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: cfg.color + "20" }}>
                <Icon className="h-3 w-3" style={{ color: cfg.color }} />
              </div>
              {i < logs.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-xs text-slate-700 font-medium leading-relaxed">{log.description}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {log.auteurNom && `${log.auteurNom} · `}{formatDateTime(log.createdAt)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Notes internes ───────────────────────────────────────────────────────────

function NotesPanel({ dossierId, userName }: { dossierId: string; userName: string }) {
  const [notes,     setNotes]     = useState<NoteInterne[]>([])
  const [contenu,   setContenu]   = useState("")
  const [loading,   setLoading]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/notes?dossierId=${dossierId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setNotes(d) })
      .finally(() => setLoading(false))
  }, [dossierId])

  async function addNote() {
    if (!contenu.trim()) return
    setSubmitting(true)
    const r = await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossierId, contenu }),
    })
    if (r.ok) {
      const note = await r.json()
      setNotes(prev => [...prev, note])
      setContenu("")
      toast.success("Note ajoutée")
    } else toast.error("Erreur")
    setSubmitting(false)
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  if (loading) return <div className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-400" /></div>

  return (
    <div className="space-y-3">
      {notes.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Aucune note</p>}
      {notes.map(n => (
        <div key={n.id} className="bg-amber-50 rounded-lg p-3 border border-amber-100 group">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-slate-700 leading-relaxed flex-1">{n.contenu}</p>
            <button onClick={() => deleteNote(n.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 flex-shrink-0">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{n.auteurNom} · {formatDateTime(n.createdAt)}</p>
        </div>
      ))}
      <div className="flex gap-2">
        <Textarea value={contenu} onChange={e => setContenu(e.target.value)}
          placeholder="Ajouter une note interne (visible RH uniquement)…"
          className="text-xs resize-none" rows={2} />
        <button onClick={addNote} disabled={submitting || !contenu.trim()}
          className="px-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors self-end h-9 flex items-center">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ─── Panneau d'analyse RH ─────────────────────────────────────────────────────

function AnalysePanel({ d, onUpdate }: { d: Demande; onUpdate: (changes: Partial<Demande>) => void }) {
  const [form, setForm] = useState({
    appreciationRH:  d.appreciationRH  ?? "",
    decisionFinale:  d.decisionFinale  ?? "",
    sanctionRetenue: d.sanctionRetenue ?? "",
    dateNotification: new Date().toISOString().split("T")[0],
    clore: true,
  })
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)

  const alreadyDone = !!d.decisionFinale

  async function save() {
    if (!form.appreciationRH.trim() || !form.decisionFinale) { toast.error("Remplissez l'appréciation et la décision"); return }
    setSaving(true)
    const r = await fetch(`/api/disciplinaire/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:          "ANALYSER",
        appreciationRH:  form.appreciationRH,
        decisionFinale:  form.decisionFinale,
        sanctionRetenue: form.sanctionRetenue || null,
        dateNotification: form.dateNotification,
        statut:          form.clore ? "CLOS" : "REPONSE_RECUE",
      }),
    })
    if (r.ok) {
      onUpdate({ appreciationRH: form.appreciationRH, decisionFinale: form.decisionFinale, sanctionRetenue: form.sanctionRetenue, statut: form.clore ? "CLOS" : d.statut })
      toast.success("Analyse enregistrée")
    } else toast.error("Erreur")
    setSaving(false)
  }

  const decCfg = form.decisionFinale ? DECISION_CFG[form.decisionFinale] : null

  return (
    <div className="space-y-4">
      {alreadyDone && d.decisionFinale && (
        <div className="rounded-lg p-3 border flex items-start gap-2"
          style={{ background: DECISION_CFG[d.decisionFinale]?.bg, borderColor: DECISION_CFG[d.decisionFinale]?.color + "40" }}>
          <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: DECISION_CFG[d.decisionFinale]?.color }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: DECISION_CFG[d.decisionFinale]?.color }}>
              Décision enregistrée : {DECISION_CFG[d.decisionFinale]?.label}
            </p>
            {d.appreciationRH && <p className="text-xs text-slate-600 mt-1">{d.appreciationRH}</p>}
            {d.sanctionRetenue && <p className="text-xs text-slate-600 mt-0.5">Sanction retenue : {d.sanctionRetenue}</p>}
            {d.dateNotificationDecision && <p className="text-[10px] text-slate-400 mt-1">Notifié le {formatDate(d.dateNotificationDecision)}</p>}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Appréciation RH *</Label>
        <Textarea value={form.appreciationRH} onChange={e => setForm(p => ({ ...p, appreciationRH: e.target.value }))}
          rows={4} placeholder="Analyse des faits, de la réponse de l'employé, éléments retenus ou écartés…"
          className="text-xs" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Décision finale *</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Object.entries(DECISION_CFG).map(([key, cfg]) => {
            const Icon = cfg.icon
            const selected = form.decisionFinale === key
            return (
              <button key={key} type="button" onClick={() => setForm(p => ({ ...p, decisionFinale: key }))}
                className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all text-center ${selected ? "border-current shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
                style={selected ? { borderColor: cfg.color, background: cfg.bg, color: cfg.color } : {}}>
                <Icon className={`h-4 w-4 ${selected ? "" : "text-slate-400"}`} />
                <span className={`text-[10px] font-semibold leading-tight ${selected ? "" : "text-slate-500"}`}>{cfg.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {(form.decisionFinale === "REJETEE" || form.decisionFinale === "PARTIELLEMENT_ACCEPTEE") && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Sanction retenue</Label>
          <Input value={form.sanctionRetenue} onChange={e => setForm(p => ({ ...p, sanctionRetenue: e.target.value }))}
            placeholder="Avertissement, blâme, mise à pied de X jours…" className="text-xs" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Date de notification</Label>
          <Input type="date" value={form.dateNotification}
            onChange={e => setForm(p => ({ ...p, dateNotification: e.target.value }))} className="text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Document de décision</Label>
          <UploadBtn dossierId={d.id} typeDoc="DOCUMENT_DECISION" label="Uploader" accept=".pdf,.doc,.docx"
            onDone={() => toast.success("Document de décision uploadé")} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.clore} onChange={e => setForm(p => ({ ...p, clore: e.target.checked }))}
            className="rounded" />
          <span className="text-xs text-slate-600">Clôturer le dossier après l&apos;analyse</span>
        </label>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all"
        style={{ background: decCfg ? decCfg.color : "#64748b" }}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer la décision
      </button>
    </div>
  )
}

// ─── Carte demande enrichie ───────────────────────────────────────────────────

type Tab = "actions" | "timeline" | "notes"

function DemandeCard({ d, role, onUpdate }: {
  d: Demande; role: string; onUpdate: (id: string, changes: Partial<Demande>) => void
}) {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? "Inconnu"

  const [expanded,    setExpanded]    = useState(false)
  const [tab,         setTab]         = useState<Tab>("actions")
  const [confirming,  setConfirming]  = useState(false)
  const [cloturing,   setCloturing]   = useState(false)
  const [modeRemise,  setModeRemise]  = useState(d.modeRemise ?? "")
  const [dateRemise,  setDateRemise]  = useState(d.dateRemiseEffective ? d.dateRemiseEffective.split("T")[0] : new Date().toISOString().split("T")[0])
  const [refusNote,   setRefusNote]   = useState("")
  const [showRefus,   setShowRefus]   = useState(false)

  const isRH   = role === "RH"   || role === "ADMIN"
  const isResp = role === "RESPONSABLE" || role === "ADMIN"
  const isClos = d.statut === "CLOS"

  const jours   = joursRestants(d.dateReponseAttendue)
  const depasse = jours !== null && jours < 0

  const docRH       = d.documents.find(doc => doc.type === "DOCUMENT_RH")
  const docReponse  = d.documents.find(doc => doc.type === "REPONSE_EMPLOYE")
  const docDecision = d.documents.find(doc => doc.type === "DOCUMENT_DECISION")
  const docAccuse   = d.documents.find(doc => doc.type === "ACCUSE_RECEPTION")

  const sc  = STATUT_CFG[d.statut] ?? { label: d.statut, color: "#64748b", bg: "#f1f5f9", step: 0 }
  const gcfg = d.niveauGravite ? GRAVITE_CFG[d.niveauGravite] : null

  async function confirmerEnvoi() {
    setConfirming(true)
    const r = await fetch(`/api/disciplinaire/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ENVOYE_EMPLOYE", modeRemise: modeRemise || undefined }),
    })
    if (r.ok) { onUpdate(d.id, await r.json()); toast.success("Transmission confirmée — délai enclenché") }
    else toast.error("Erreur")
    setConfirming(false)
  }

  async function signalerRefus() {
    const r = await fetch(`/api/disciplinaire/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REFUS_RECEPTION", note: refusNote }),
    })
    if (r.ok) { onUpdate(d.id, { refusReception: true, refusReceptionNote: refusNote }); toast.success("Refus signalé"); setShowRefus(false) }
    else toast.error("Erreur")
  }

  async function clore() {
    setCloturing(true)
    const r = await fetch(`/api/disciplinaire/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CLORE" }),
    })
    if (r.ok) { onUpdate(d.id, { statut: "CLOS" }); toast.success("Demande clôturée") }
    else toast.error("Erreur")
    setCloturing(false)
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isClos ? "opacity-70" : ""}`}
      style={{ borderLeftWidth: "4px", borderLeftColor: isClos ? "#94a3b8" : "#d97706" }}>

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <button className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(v => !v)}>
        <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-amber-700 bg-amber-100">
          {d.employe.prenom[0]}{d.employe.nom[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{d.employe.prenom} {d.employe.nom}</span>
            <span className="text-xs text-slate-400">{d.employe.matricule}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
            {gcfg && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: gcfg.bg, color: gcfg.color }}>
                {d.niveauGravite}
              </span>
            )}
            {d.sanctionAutoAppliquee && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                <TriangleAlert className="h-3 w-3" /> Sanction auto
              </span>
            )}
            {d.decisionFinale && DECISION_CFG[d.decisionFinale] && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: DECISION_CFG[d.decisionFinale].bg, color: DECISION_CFG[d.decisionFinale].color }}>
                {DECISION_CFG[d.decisionFinale].label}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-0.5 truncate">{d.motif}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">{formatDate(d.date)} · {d.initiateur?.name ?? "—"}</span>
            {d.categoriesFaits && <span className="text-xs text-slate-500">{CATEGORIES_LABEL[d.categoriesFaits] ?? d.categoriesFaits}</span>}
            {d.statut === "EN_ATTENTE_REP" && jours !== null && (
              <span className={`text-xs font-semibold flex items-center gap-1 ${depasse ? "text-red-600" : jours <= 3 ? "text-amber-600" : "text-slate-500"}`}>
                <Clock className="h-3 w-3" />
                {depasse ? `${Math.abs(jours)} j de retard` : `${jours} j restant(s) · ${formatDate(d.dateReponseAttendue)}`}
              </span>
            )}
            {d.statutReponse === "DANS_DELAI"  && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Dans les délais</span>}
            {d.statutReponse === "HORS_DELAI"  && <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><TriangleAlert className="h-3 w-3" /> Hors délai</span>}
            {d.refusReception && <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><XCircle className="h-3 w-3" /> Refus de réception</span>}
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {/* ── Détail dépliable ──────────────────────────────────────────────── */}
      <div className={`transition-all duration-300 overflow-hidden ${expanded ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">

          {/* Barre d'étapes */}
          <div className="flex justify-center">
            <StepBar statut={d.statut} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {([
              ["actions",  "Actions",  Wrench],
              ["timeline", "Journal",  History],
              ["notes",    "Notes RH", StickyNote],
            ] as [Tab, string, React.ElementType][]).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === id ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* ── TAB : ACTIONS ─────────────────────────────────────────────── */}
          {tab === "actions" && (
            <div className="space-y-4">

              {/* Description et contexte */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-slate-700 leading-relaxed">{d.description}</p>
                {d.temoins && (
                  <p className="text-xs text-slate-500"><span className="font-semibold">Témoins :</span> {d.temoins}</p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                  <div><p className="font-semibold text-slate-600">Délai accordé</p><p className="text-slate-700">{d.delaiReponseJours} jours</p></div>
                  <div><p className="font-semibold text-slate-600">Échéance</p><p className="text-slate-700">{formatDate(d.dateReponseAttendue) || "Non démarrée"}</p></div>
                  <div><p className="font-semibold text-slate-600">Réponse reçue</p><p className="text-slate-700">{formatDate(d.dateReponseReelle) || "—"}</p></div>
                </div>
              </div>

              {/* Documents existants */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {docRH && <DocLink doc={docRH} label="Document officiel" color="#3b82f6" icon={FileText} />}
                  {docAccuse && <DocLink doc={docAccuse} label="Accusé de réception" color="#10b981" icon={CheckCheck} />}
                  {docReponse && <DocLink doc={docReponse} label="Réponse employé" color="#8b5cf6" icon={FileScan} />}
                  {docDecision && <DocLink doc={docDecision} label="Document de décision" color="#059669" icon={CheckCircle} />}
                  {!docRH && !docAccuse && !docReponse && !docDecision && (
                    <p className="text-xs text-slate-400">Aucun document pour le moment</p>
                  )}
                </div>
              </div>

              {/* Infos transmission */}
              {(d.modeRemise || d.dateRemiseEffective) && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs space-y-1">
                  <p className="font-semibold text-blue-800">Transmission</p>
                  {d.modeRemise && <p className="text-blue-700">Mode : {MODES_LABEL[d.modeRemise] ?? d.modeRemise}</p>}
                  {d.dateRemiseEffective && <p className="text-blue-700">Date effective : {formatDate(d.dateRemiseEffective)}</p>}
                  {d.refusReception && <p className="text-red-600 font-semibold">⚠ Refus de réception signalé{d.refusReceptionNote ? ` — ${d.refusReceptionNote}` : ""}</p>}
                </div>
              )}

              {/* ── Actions RH ──────────────────────────── */}
              {isRH && !isClos && (
                <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/40 space-y-3">
                  <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Actions RH
                  </p>
                  {d.statut === "INITIE" && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600">Générez et uploadez le document officiel de demande d&apos;explication.</p>
                      <UploadBtn dossierId={d.id} typeDoc="DOCUMENT_RH" label="Uploader le document officiel"
                        accept=".pdf,.doc,.docx"
                        onDone={() => onUpdate(d.id, { statut: "DOCUMENT_PRET" })} />
                    </div>
                  )}
                  {d.statut === "REPONSE_RECUE" && (
                    <AnalysePanel d={d} onUpdate={changes => onUpdate(d.id, changes)} />
                  )}
                  {d.statut !== "INITIE" && d.statut !== "CLOS" && d.statut !== "REPONSE_RECUE" && (
                    <button onClick={clore} disabled={cloturing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                      {cloturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Forcer la clôture
                    </button>
                  )}
                </div>
              )}

              {/* ── Actions RESPONSABLE ─────────────────── */}
              {isResp && !isClos && (
                <div className="border border-amber-100 rounded-xl p-4 bg-amber-50/40 space-y-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" /> Actions Responsable
                  </p>

                  {d.statut === "DOCUMENT_PRET" && (
                    <div className="space-y-3">
                      {docRH && (
                        <a href={`/api/files/${docRH.url}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                          <Download className="h-3.5 w-3.5" /> Télécharger le document
                        </a>
                      )}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-slate-600">Mode de remise</Label>
                          <Select value={modeRemise} onValueChange={setModeRemise}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                            <SelectContent>{MODES_REMISE.map(m => <SelectItem key={m} value={m}>{MODES_LABEL[m]}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-slate-600">Date de remise</Label>
                          <Input type="date" value={dateRemise} onChange={e => setDateRemise(e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={confirmerEnvoi} disabled={confirming}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors">
                          {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Confirmer la transmission à l&apos;employé
                        </button>
                        <UploadBtn dossierId={d.id} typeDoc="ACCUSE_RECEPTION" label="Uploader accusé de réception"
                          accept=".pdf,.jpg,.jpeg,.png" modeRemise={modeRemise} dateRemise={dateRemise}
                          onDone={() => onUpdate(d.id, { accuseReceptionUrl: "uploaded", modeRemise: modeRemise || null })} />
                        <button onClick={() => setShowRefus(v => !v)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <XCircle className="h-3.5 w-3.5" /> Signaler refus de réception
                        </button>
                      </div>
                      {showRefus && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-red-700">Refus de réception</p>
                          <Input value={refusNote} onChange={e => setRefusNote(e.target.value)}
                            placeholder="Motif ou contexte du refus…" className="text-xs h-8" />
                          <div className="flex gap-2">
                            <button onClick={signalerRefus} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700">
                              Confirmer
                            </button>
                            <button onClick={() => setShowRefus(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600">
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {d.statut === "EN_ATTENTE_REP" && (
                    <div className="space-y-2">
                      {depasse && (
                        <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          Délai dépassé — une sanction sera appliquée automatiquement à réception
                        </div>
                      )}
                      <UploadBtn dossierId={d.id} typeDoc="REPONSE_EMPLOYE"
                        label={depasse ? "Uploader la réponse (tardive)" : "Scanner et uploader la réponse"}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onDone={() => onUpdate(d.id, { statut: "REPONSE_RECUE", dateReponseReelle: new Date().toISOString() })} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB : JOURNAL ─────────────────────────────────────────────── */}
          {tab === "timeline" && <Timeline dossierId={d.id} />}

          {/* ── TAB : NOTES RH ────────────────────────────────────────────── */}
          {tab === "notes" && <NotesPanel dossierId={d.id} userName={userName} />}
        </div>
      </div>
    </div>
  )
}

function DocLink({ doc, label, color, icon: Icon }: { doc: Document; label: string; color: string; icon: React.ElementType }) {
  return (
    <a href={`/api/files/${doc.url}`} target="_blank" rel="noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:opacity-80"
      style={{ background: color + "15", color, borderColor: color + "40" }}>
      <Icon className="h-3.5 w-3.5" />
      {label}{doc.taille ? ` · ${formatBytes(doc.taille)}` : ""}
      <Download className="h-3 w-3 ml-0.5" />
    </a>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function DemandesExplicationPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role ?? "RH"

  const [demandes, setDemandes] = useState<Demande[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [onglet,   setOnglet]   = useState<"actifs" | "clos">("actifs")
  const [form, setForm] = useState({
    employeId: "", date: "", motif: "", description: "",
    delaiReponseJours: "5", categoriesFaits: "", niveauGravite: "", temoins: "",
  })

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/disciplinaire").then(r => r.ok ? r.json() : []),
      fetch("/api/employes").then(r => r.ok ? r.json() : []),
    ]).then(([all, e]) => {
      if (Array.isArray(all)) setDemandes(all.filter((d: Demande) => d.type === "DEMANDE_EXPLICATION"))
      if (Array.isArray(e))   setEmployes(e)
    })
  }, [])

  useEffect(() => { load() }, [load])

  function onUpdate(id: string, changes: Partial<Demande>) {
    setDemandes(prev => prev.map(d => d.id === id ? { ...d, ...changes } : d))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const r = await fetch("/api/disciplinaire", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, type: "DEMANDE_EXPLICATION" }),
    })
    if (r.ok) {
      toast.success("Demande d'explication soumise au RH")
      setShowForm(false)
      setForm({ employeId: "", date: "", motif: "", description: "", delaiReponseJours: "5", categoriesFaits: "", niveauGravite: "", temoins: "" })
      load()
    } else toast.error("Erreur lors de la soumission")
    setLoading(false)
  }

  const actifs     = demandes.filter(d => d.statut !== "CLOS")
  const clos       = demandes.filter(d => d.statut === "CLOS")
  const horsDelai  = actifs.filter(d => { const j = joursRestants(d.dateReponseAttendue); return d.statut === "EN_ATTENTE_REP" && j !== null && j <= 0 }).length
  const urgents    = actifs.filter(d => { const j = joursRestants(d.dateReponseAttendue); return d.statut === "EN_ATTENTE_REP" && j !== null && j > 0 && j <= 3 }).length
  const aAnalyser  = actifs.filter(d => d.statut === "REPONSE_RECUE").length
  const liste      = onglet === "actifs" ? actifs : clos

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Demandes d&apos;explication</h1>
          <p className="text-sm text-slate-500 mt-1">{actifs.length} en cours · {clos.length} clôturée(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <Plus className="h-4 w-4" /> Nouvelle demande
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {actifs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "En cours",       value: actifs.length,  color: "#64748b", bg: "#f8fafc" },
            { label: "À analyser",     value: aAnalyser,      color: "#6366f1", bg: "#eef2ff" },
            { label: "Délai urgent",   value: urgents,        color: "#d97706", bg: "#fffbeb" },
            { label: "Hors délai",     value: horsDelai,      color: "#dc2626", bg: "#fef2f2" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border px-4 py-3 flex flex-col"
              style={{ background: s.bg, borderColor: s.color + "30" }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alertes */}
      {horsDelai > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 flex items-center gap-3">
          <Bell className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">
            <strong>{horsDelai}</strong> demande(s) hors délai — sanction automatique à réception de la réponse.
          </p>
        </div>
      )}
      {urgents > 0 && horsDelai === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-center gap-3">
          <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{urgents}</strong> demande(s) arrivent à échéance dans moins de 3 jours.
          </p>
        </div>
      )}

      {/* Formulaire */}
      <div className={`transition-all duration-300 overflow-hidden ${showForm ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
          <h2 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Nouvelle demande d&apos;explication
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
              <Label className="text-xs font-medium text-slate-600">Date des faits *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Catégorie des faits</Label>
              <Select value={form.categoriesFaits} onValueChange={v => setForm(p => ({ ...p, categoriesFaits: v }))}>
                <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORIES_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Niveau de gravité</Label>
              <Select value={form.niveauGravite} onValueChange={v => setForm(p => ({ ...p, niveauGravite: v }))}>
                <SelectTrigger><SelectValue placeholder="Gravité" /></SelectTrigger>
                <SelectContent>{GRAVITES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Délai de réponse (jours) *</Label>
              <Input type="number" min={1} max={30} value={form.delaiReponseJours}
                onChange={e => setForm(p => ({ ...p, delaiReponseJours: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Témoins éventuels</Label>
              <Input value={form.temoins} onChange={e => setForm(p => ({ ...p, temoins: e.target.value }))}
                placeholder="Noms des témoins…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-slate-600">Motif *</Label>
              <Input value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))}
                placeholder="Résumé en une ligne" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-slate-600">Description détaillée des faits *</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={4} required placeholder="Décrivez précisément les faits reprochés, le contexte, les éléments de preuve…" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={loading || !form.employeId || !form.date || !form.motif}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#d97706" }}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Soumettre au RH
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(["actifs", "clos"] as const).map(tab => (
          <button key={tab} onClick={() => setOnglet(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${onglet === tab ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {tab === "actifs" ? `En cours (${actifs.length})` : `Clôturées (${clos.length})`}
          </button>
        ))}
      </div>

      {/* Liste */}
      {liste.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-slate-500">
            {onglet === "actifs" ? "Aucune demande en cours" : "Aucune demande clôturée"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {liste.map(d => <DemandeCard key={d.id} d={d} role={role} onUpdate={onUpdate} />)}
        </div>
      )}
    </div>
  )
}
