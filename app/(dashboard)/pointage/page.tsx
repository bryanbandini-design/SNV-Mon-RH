"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { QrCode, Users, Clock, CheckCircle, AlertCircle, Plus, Download, RefreshCw, Trash2, Fingerprint, Wifi, WifiOff, Timer, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { QRCodeCanvas as QRCode } from "qrcode.react"

interface Pointage {
  id: string
  dateEntree: string
  dateSortie?: string
  statut: string
  faceVerified: boolean
  faceScore?: number
  noteRH?: string
  source?: string
  verifyMethod?: string
  employe: { prenom: string; nom: string; matricule: string; poste: string; photoUrl?: string }
  atelier?: { nom: string; couleur: string }
}

interface ZkDevice {
  id: string
  serialNumber: string
  nom: string
  lieu: string | null
  actif: boolean
  lastSyncAt: string | null
  totalPushes: number
  _count: { pointages: number }
}

interface EmployePin {
  id: string
  prenom: string
  nom: string
  matricule: string
  poste: string
  zktecoPin: string | null
}

interface Atelier {
  id: string
  nom: string
  code: string
  couleur: string
}

interface PresenceManuelle {
  id: string
  date: string
  heureArrivee: string | null
  heureDepart:  string | null
  statut: string
  statutValidation: string
  notes: string | null
  saisieParNom: string | null
  employe: { prenom: string; nom: string; matricule: string; poste: string }
}

const STATUT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  EN_ATTENTE: { label: "En attente", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  CONFIRME:   { label: "Confirmé",   color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  FACE_ECHEC: { label: "Face échouée", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  MANUEL:     { label: "Manuel",     color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
  SORTI:      { label: "Sorti",      color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
}

export default function PointagePage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRole = (session?.user as any)?.role as string | undefined
  const isResponsable = currentRole === "RESPONSABLE" || currentRole === "RH"
  const isAdmin       = currentRole === "ADMIN"

  const [tab, setTab] = useState<"live" | "historique" | "ateliers" | "qr" | "zkteco" | "manuel">("live")
  const [presencesManuelles, setPresencesManuelles] = useState<PresenceManuelle[]>([])
  const [presLoading, setPresLoading]   = useState(false)
  const [validating, setValidating]     = useState<string | null>(null)
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [ateliers, setAteliers]   = useState<Atelier[]>([])
  const [loading, setLoading]     = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [newAtelier, setNewAtelier] = useState({ nom: "", code: "", couleur: "#3b82f6" })
  const [qrTarget, setQrTarget]   = useState<"entree" | Atelier>("entree")
  const [totalPresents, setTotalPresents] = useState(0)

  // ZKTeco
  const [zkDevices, setZkDevices]     = useState<ZkDevice[]>([])
  const [zkEmployes, setZkEmployes]   = useState<EmployePin[]>([])
  const [zkNewDevice, setZkNewDevice] = useState({ serialNumber: "", nom: "", lieu: "" })
  const [zkPinEdit, setZkPinEdit]     = useState<Record<string, string>>({})
  const [zkSaving, setZkSaving]       = useState<string | null>(null)
  const [zkServerUrl, setZkServerUrl] = useState("")

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  const fetchPointages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pointage/admin?date=${selectedDate}`)
      const data = await res.json()
      setPointages(data.pointages ?? [])
      setTotalPresents(
        (data.pointages ?? []).filter((p: Pointage) => ["CONFIRME", "EN_ATTENTE"].includes(p.statut)).length
      )
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchAteliers = useCallback(async () => {
    const res = await fetch("/api/ateliers")
    setAteliers(await res.json())
  }, [])

  const fetchZkData = useCallback(async () => {
    const [dRes, eRes] = await Promise.all([
      fetch("/api/zkteco/devices"),
      fetch("/api/zkteco/employes"),
    ])
    if (dRes.ok) setZkDevices(await dRes.json())
    if (eRes.ok) {
      const emps: EmployePin[] = await eRes.json()
      setZkEmployes(emps)
      const pins: Record<string, string> = {}
      emps.forEach(e => { pins[e.id] = e.zktecoPin ?? "" })
      setZkPinEdit(pins)
    }
  }, [])

  const fetchPresencesManuelles = useCallback(async () => {
    setPresLoading(true)
    const res = await fetch("/api/presences?manuel=all")
    if (res.ok) setPresencesManuelles(await res.json())
    setPresLoading(false)
  }, [])

  async function validerPresence(id: string, action: "VALIDER" | "REJETER") {
    setValidating(id)
    await fetch(`/api/presences/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action }),
    })
    await fetchPresencesManuelles()
    setValidating(null)
  }

  useEffect(() => { fetchPointages(); fetchAteliers() }, [fetchPointages, fetchAteliers])
  useEffect(() => { if (tab === "zkteco") fetchZkData() }, [tab, fetchZkData])
  useEffect(() => { if (tab === "manuel") fetchPresencesManuelles() }, [tab, fetchPresencesManuelles])
  useEffect(() => { if (baseUrl) setZkServerUrl(baseUrl) }, [baseUrl])

  async function addAtelier() {
    if (!newAtelier.nom || !newAtelier.code) return
    const res = await fetch("/api/ateliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAtelier),
    })
    if (res.ok) {
      setNewAtelier({ nom: "", code: "", couleur: "#3b82f6" })
      fetchAteliers()
    }
  }

  async function deleteAtelier(id: string) {
    await fetch(`/api/ateliers?id=${id}`, { method: "DELETE" })
    fetchAteliers()
  }

  async function addZkDevice() {
    if (!zkNewDevice.serialNumber) return
    await fetch("/api/zkteco/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zkNewDevice),
    })
    setZkNewDevice({ serialNumber: "", nom: "", lieu: "" })
    fetchZkData()
  }

  async function deleteZkDevice(id: string) {
    if (!confirm("Supprimer ce terminal ?")) return
    await fetch(`/api/zkteco/devices/${id}`, { method: "DELETE" })
    fetchZkData()
  }

  async function savePin(employeId: string) {
    setZkSaving(employeId)
    const res = await fetch("/api/zkteco/employes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId, zktecoPin: zkPinEdit[employeId] || null }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.message ?? "Erreur")
    }
    setZkSaving(null)
    fetchZkData()
  }

  const qrUrl = qrTarget === "entree"
    ? `${baseUrl}/pointer/entree`
    : `${baseUrl}/pointer/atelier/${(qrTarget as Atelier).code}`

  const presents = pointages.filter(p => ["CONFIRME", "EN_ATTENTE"].includes(p.statut)).length
  const confirmes = pointages.filter(p => p.statut === "CONFIRME").length

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Pointage QR</h1>
          <p className="text-slate-500 text-sm mt-0.5">Suivi des présences par QR code et reconnaissance faciale</p>
        </div>
        <button onClick={fetchPointages}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <RefreshCw size={15} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Présents aujourd'hui", value: presents, icon: <Users size={20} />, color: "#22c55e" },
          { label: "Confirmés (face OK)", value: confirmes, icon: <CheckCircle size={20} />, color: "#38bdf8" },
          { label: "En attente",  value: pointages.filter(p => p.statut === "EN_ATTENTE").length, icon: <Clock size={20} />, color: "#f59e0b" },
          { label: "Ateliers actifs", value: ateliers.length, icon: <QrCode size={20} />, color: "#8b5cf6" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}18`, color: kpi.color }}>
                {kpi.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto w-full sm:w-fit">
        {[
          { key: "live",       label: "Vue live" },
          { key: "manuel",     label: "Pointages employés", icon: <Timer size={13} />, badge: presencesManuelles.filter(p => p.statutValidation === "EN_ATTENTE").length },
          { key: "historique", label: "Historique" },
          { key: "ateliers",   label: "Ateliers" },
          { key: "qr",         label: "QR Codes" },
          { key: "zkteco",     label: "Empreinte ZKTeco", icon: <Fingerprint size={13} /> },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key as "live" | "historique" | "ateliers" | "qr" | "zkteco" | "manuel")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tab === t.key
              ? { background: "white", color: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
              : { color: "#64748b" }}>
            {t.icon ?? null}
            {t.label}
            {"badge" in t && (t as { badge: number }).badge > 0 && (
              <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center leading-none">
                {(t as { badge: number }).badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Vue live ── */}
      {tab === "live" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Présents maintenant</h2>
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              En temps réel
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Chargement…</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pointages.filter(p => ["CONFIRME", "EN_ATTENTE"].includes(p.statut)).map(p => (
                <PointageRow key={p.id} pointage={p} onRefresh={fetchPointages} />
              ))}
              {pointages.filter(p => ["CONFIRME", "EN_ATTENTE"].includes(p.statut)).length === 0 && (
                <div className="py-16 text-center text-slate-400 text-sm">Aucun employé présent actuellement</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Historique ── */}
      {tab === "historique" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-slate-800">Historique</h2>
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700" />
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Chargement…</div>
            ) : pointages.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">Aucun pointage pour cette date</div>
            ) : pointages.map(p => (
              <PointageRow key={p.id} pointage={p} onRefresh={fetchPointages} />
            ))}
          </div>
        </div>
      )}

      {/* ── Ateliers ── */}
      {tab === "ateliers" && (
        <div className="space-y-4">
          {/* Formulaire ajout */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Ajouter un atelier</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nom</label>
                <input value={newAtelier.nom} onChange={e => setNewAtelier(s => ({ ...s, nom: e.target.value }))}
                  placeholder="Atelier A" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Code (unique)</label>
                <input value={newAtelier.code} onChange={e => setNewAtelier(s => ({ ...s, code: e.target.value.toUpperCase() }))}
                  placeholder="ATELIER_A" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono" />
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Couleur</label>
                  <input type="color" value={newAtelier.couleur}
                    onChange={e => setNewAtelier(s => ({ ...s, couleur: e.target.value }))}
                    className="h-9 w-16 rounded-lg border border-slate-200 cursor-pointer" />
                </div>
                <button onClick={addAtelier}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                  <Plus size={16} />
                  Ajouter
                </button>
              </div>
            </div>
          </div>

          {/* Liste */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Ateliers configurés</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {ateliers.map(a => (
                <div key={a.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl" style={{ background: a.couleur }} />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{a.nom}</div>
                      <div className="text-xs text-slate-400 font-mono">{a.code}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setQrTarget(a); setTab("qr") }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
                      <QrCode size={13} />
                      QR Code
                    </button>
                    <button onClick={() => deleteAtelier(a.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {ateliers.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm">Aucun atelier configuré</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QR Codes ── */}
      {tab === "qr" && (
        <div className="space-y-6">
          {/* Sélecteur */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Générer un QR code</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setQrTarget("entree")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
                style={qrTarget === "entree"
                  ? { borderColor: "#38bdf8", background: "rgba(56,189,248,0.08)", color: "#0284c7" }
                  : { borderColor: "#e2e8f0", color: "#475569" }}>
                <QrCode size={16} />
                QR Entrée centrale
              </button>
              {ateliers.map(a => (
                <button key={a.id} onClick={() => setQrTarget(a)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
                  style={typeof qrTarget !== "string" && qrTarget.id === a.id
                    ? { borderColor: a.couleur, background: `${a.couleur}14`, color: a.couleur }
                    : { borderColor: "#e2e8f0", color: "#475569" }}>
                  <div className="h-3 w-3 rounded-full" style={{ background: a.couleur }} />
                  {a.nom}
                </button>
              ))}
            </div>
          </div>

          {/* QR display */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col items-center gap-6">
            <div style={{ padding: 24, borderRadius: 20, background: "white",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #f1f5f9" }}>
              <QRCode value={qrUrl} size={220}
                fgColor={typeof qrTarget !== "string" ? qrTarget.couleur : "#0f172a"}
                level="M" />
            </div>

            <div className="text-center">
              <div className="font-semibold text-slate-800 text-lg mb-1">
                {qrTarget === "entree" ? "Entrée principale" : (qrTarget as Atelier).nom}
              </div>
              <div className="text-xs text-slate-400 font-mono break-all max-w-xs">{qrUrl}</div>
            </div>

            <button
              onClick={() => {
                const canvas = document.querySelector("canvas") as HTMLCanvasElement
                if (!canvas) return
                const link = document.createElement("a")
                link.download = `qr-${qrTarget === "entree" ? "entree" : (qrTarget as Atelier).code}.png`
                link.href = canvas.toDataURL()
                link.click()
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              <Download size={16} />
              Télécharger PNG
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet ZKTeco ── */}
      {tab === "zkteco" && (
        <div className="space-y-6">

          {/* Bannière d'info configuration */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Fingerprint size={15} /> Configuration du terminal ZKTeco</p>
            <p>Sur le terminal, menu <strong>Comm → Serveur ADMS</strong> :</p>
            <div className="font-mono bg-white border border-blue-100 rounded px-3 py-2 text-blue-800 text-xs mt-1 break-all">
              Adresse serveur : <strong>{zkServerUrl || "http://votre-serveur.com"}</strong><br />
              Port : <strong>80</strong> (ou 3003 en développement)<br />
              Activer ADMS : <strong>OUI</strong>
            </div>
            <p className="text-xs text-blue-700">Le terminal enverra automatiquement chaque pointage empreinte vers <code>/iclock/cdata</code></p>
          </div>

          {/* Terminaux enregistrés */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Fingerprint size={16} className="text-indigo-500" />
                Terminaux ZKTeco
              </h2>
              <span className="text-xs text-slate-400">{zkDevices.length} terminal(aux) enregistré(s)</span>
            </div>

            {/* Ajout terminal */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-3">Ajouter un terminal</p>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  placeholder="N° de série (SN)"
                  value={zkNewDevice.serialNumber}
                  onChange={e => setZkNewDevice(p => ({ ...p, serialNumber: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-44"
                />
                <input
                  type="text"
                  placeholder="Nom (ex: Entrée principale)"
                  value={zkNewDevice.nom}
                  onChange={e => setZkNewDevice(p => ({ ...p, nom: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40"
                />
                <input
                  type="text"
                  placeholder="Lieu (optionnel)"
                  value={zkNewDevice.lieu}
                  onChange={e => setZkNewDevice(p => ({ ...p, lieu: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-36"
                />
                <button onClick={addZkDevice} disabled={!zkNewDevice.serialNumber}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "#4f46e5" }}>
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>

            {zkDevices.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                Aucun terminal enregistré — les terminaux se déclarent automatiquement à la première connexion.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {zkDevices.map(d => {
                  const lastSync  = d.lastSyncAt ? new Date(d.lastSyncAt) : null
                  const minAgo    = lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 60000) : null
                  const isOnline  = minAgo !== null && minAgo < 2
                  return (
                    <div key={d.id} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isOnline ? "bg-green-100" : "bg-slate-100"}`}>
                          {isOnline
                            ? <Wifi size={16} className="text-green-600" />
                            : <WifiOff size={16} className="text-slate-400" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{d.nom}</p>
                          <p className="text-xs text-slate-400">
                            SN : <span className="font-mono">{d.serialNumber}</span>
                            {d.lieu && <> · {d.lieu}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="text-center">
                          <p className="font-semibold text-slate-800">{d.totalPushes}</p>
                          <p>pointages</p>
                        </div>
                        <div className="text-center">
                          <p className={`font-semibold ${isOnline ? "text-green-600" : "text-slate-400"}`}>
                            {isOnline ? "En ligne" : lastSync ? `Il y a ${minAgo}min` : "Jamais"}
                          </p>
                          <p>dernière synchro</p>
                        </div>
                        <button onClick={() => deleteZkDevice(d.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mapping employés ↔ PIN */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Mapping Employés ↔ PIN ZKTeco</h2>
              <span className="text-xs text-slate-400">
                {zkEmployes.filter(e => e.zktecoPin).length} / {zkEmployes.length} mappés
              </span>
            </div>
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
              Le PIN doit correspondre exactement au numéro d'employé enregistré dans le terminal ZKTeco (menu <strong>Gestion utilisateurs</strong>).
            </div>
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {zkEmployes.map(e => (
                <div key={e.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: e.zktecoPin ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#e2e8f0", color: e.zktecoPin ? "white" : "#94a3b8" }}>
                      {e.prenom[0]}{e.nom[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{e.prenom} {e.nom}</p>
                      <p className="text-xs text-slate-400">{e.matricule} · {e.poste}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="PIN"
                      value={zkPinEdit[e.id] ?? ""}
                      onChange={ev => setZkPinEdit(p => ({ ...p, [e.id]: ev.target.value }))}
                      className="border rounded-lg px-3 py-1.5 text-sm w-24 text-center font-mono"
                    />
                    <button
                      onClick={() => savePin(e.id)}
                      disabled={zkSaving === e.id || zkPinEdit[e.id] === (e.zktecoPin ?? "")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-colors"
                      style={{ background: "#4f46e5" }}>
                      {zkSaving === e.id ? "…" : "Enreg."}
                    </button>
                    {e.zktecoPin && (
                      <span className="text-xs text-green-600 font-medium">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Pointages manuels employés ── */}
      {tab === "manuel" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Pointages saisis par les employés depuis leur espace personnel — à valider ou rejeter.
            </p>
            <button onClick={fetchPresencesManuelles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>

          {/* Bandeau rôle */}
          {isAdmin && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Mode administrateur</span> — La validation des horaires est du ressort du responsable de shift. Vous intervenez uniquement en cas de litige ou contestation (bouton &quot;Contester&quot;).
              </p>
            </div>
          )}
          {isResponsable && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700">
                <span className="font-semibold">Validation responsable</span> — Certifiez la véracité des horaires saisis par votre équipe en cliquant sur &quot;Valider&quot;. Utilisez &quot;Rejeter&quot; si les informations ne correspondent pas.
              </p>
            </div>
          )}

          {presLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : presencesManuelles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-14">
              <Timer className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="text-sm text-slate-400">Aucun pointage employé enregistré</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* En attente */}
              {presencesManuelles.filter(p => p.statutValidation === "EN_ATTENTE").length > 0 && (
                <>
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-semibold text-amber-700">
                      En attente de validation ({presencesManuelles.filter(p => p.statutValidation === "EN_ATTENTE").length})
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {presencesManuelles.filter(p => p.statutValidation === "EN_ATTENTE").map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {p.employe.prenom[0]}{p.employe.nom[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{p.employe.prenom} {p.employe.nom}</p>
                            <p className="text-xs text-slate-400">{p.employe.poste} · {p.employe.matricule}</p>
                            <p className="text-xs text-slate-500 mt-0.5 capitalize">
                              {new Date(p.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                              {" · "}
                              <span className="font-mono">{p.heureArrivee ?? "--:--"} → {p.heureDepart ?? "--:--"}</span>
                            </p>
                            {p.notes && <p className="text-xs text-slate-400 italic mt-0.5">{p.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {/* Responsable/RH : Valider + Rejeter */}
                          {(isResponsable || (!isAdmin && !isResponsable)) && (
                            <button
                              onClick={() => validerPresence(p.id, "VALIDER")}
                              disabled={validating === p.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50">
                              {validating === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Valider
                            </button>
                          )}
                          {/* Admin : contester seulement — intervention litige */}
                          <button
                            onClick={() => validerPresence(p.id, "REJETER")}
                            disabled={validating === p.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                              isAdmin
                                ? "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                                : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
                            }`}>
                            {validating === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                            {isAdmin ? "Contester" : "Rejeter"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Historique validés/rejetés */}
              {presencesManuelles.filter(p => p.statutValidation !== "EN_ATTENTE").length > 0 && (
                <>
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Traités</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {presencesManuelles.filter(p => p.statutValidation !== "EN_ATTENTE").map(p => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                            {p.employe.prenom[0]}{p.employe.nom[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700">{p.employe.prenom} {p.employe.nom}</p>
                            <p className="text-xs text-slate-400 font-mono">
                              {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                              {" · "}{p.heureArrivee ?? "--:--"} → {p.heureDepart ?? "--:--"}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          p.statutValidation === "VALIDEE"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-red-50 text-red-500 border border-red-200"
                        }`}>
                          {p.statutValidation === "VALIDEE" ? "Validé" : "Rejeté"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PointageRow({ pointage: p, onRefresh }: { pointage: Pointage; onRefresh: () => void }) {
  const statut = STATUT_LABELS[p.statut] ?? { label: p.statut, color: "#64748b", bg: "#f1f5f9" }

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)" }}>
          {p.employe.prenom[0]}{p.employe.nom[0]}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">
            {p.employe.prenom} {p.employe.nom}
          </div>
          <div className="text-xs text-slate-400">
            {p.employe.poste} · {p.employe.matricule}
          </div>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
        {/* Atelier */}
        {p.atelier ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: p.atelier.couleur }} />
            {p.atelier.nom}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}

        {/* Heure */}
        <div className="text-xs text-slate-500">
          {new Date(p.dateEntree).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          {p.dateSortie && ` → ${new Date(p.dateSortie).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
        </div>

        {/* Source / méthode */}
        <div className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: p.source === "ZKTECO" ? "rgba(79,70,229,0.1)" : "rgba(56,189,248,0.1)",
            color:      p.source === "ZKTECO" ? "#4f46e5" : "#0284c7",
          }}>
          {p.source === "ZKTECO"
            ? `🖐 ${p.verifyMethod ?? "ZKTeco"}`
            : p.faceVerified ? "✓ Face" : "QR"
          }
        </div>

        {/* Statut */}
        <div className="px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: statut.bg, color: statut.color }}>
          {statut.label}
        </div>
      </div>
    </div>
  )
}
