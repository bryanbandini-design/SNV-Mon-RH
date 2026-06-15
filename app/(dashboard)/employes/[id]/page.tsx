import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Calendar, AlertTriangle, DollarSign, Edit,
  Phone, Mail, MapPin, FlaskConical, Briefcase, Clock, Star,
} from "lucide-react"
import { formatDate, formatCurrency, MOIS } from "@/lib/utils"
import { CompteAccessPanel } from "@/components/employes/compte-access-panel"

export default async function EmployePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const employe = await prisma.employe.findUnique({
    where: { id },
    include: {
      conges:               { orderBy: { createdAt: "desc" }, take: 5 },
      dossiersDisciplinaires: { orderBy: { date: "desc" }, take: 5 },
      historiqueSalaires:   { orderBy: [{ annee: "desc" }, { mois: "desc" }], take: 6 },
      evaluations:          { orderBy: { dateEval: "desc" }, take: 3 },
      utilisateur:          { select: { id: true, email: true, createdAt: true } },
    },
  })

  if (!employe) notFound()

  const now = new Date()
  const embauche = new Date(employe.dateEmbauche)
  const diffMs = now.getTime() - embauche.getTime()
  const diffMois = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30))
  const anciennete = diffMois >= 12
    ? `${Math.floor(diffMois / 12)} an${Math.floor(diffMois / 12) > 1 ? "s" : ""}`
    : `${diffMois} mois`

  const congesApprouves = employe.conges.filter(c => c.statut === "APPROUVE").length
  const derniereEval = employe.evaluations[0]

  const statutColor: Record<string, string> = {
    ACTIF:    "#10b981", INACTIF: "#94a3b8", SUSPENDU: "#f59e0b",
  }
  const statutBg: Record<string, string> = {
    ACTIF:    "#ecfdf5", INACTIF: "#f8fafc",  SUSPENDU: "#fffbeb",
  }
  const sc = statutColor[employe.statut] ?? "#94a3b8"
  const sb = statutBg[employe.statut]   ?? "#f8fafc"

  const essaiActif = employe.periodeEssai && employe.dateFinEssai && now < new Date(employe.dateFinEssai)
  const joursEssai = employe.dateFinEssai
    ? Math.ceil((new Date(employe.dateFinEssai).getTime() - now.getTime()) / 86400000)
    : 0

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Breadcrumb ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/employes">
          <button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Retour aux employés
          </button>
        </Link>
        <Link href={`/employes/${employe.id}/modifier`}>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Edit className="h-4 w-4" />
            Modifier la fiche
          </button>
        </Link>
      </div>

      {/* ── Hero ───────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
      >
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-lg"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
            >
              {employe.prenom[0]}{employe.nom[0]}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{employe.prenom} {employe.nom}</h1>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: sb, color: sc }}
                >
                  {employe.statut}
                </span>
                {essaiActif && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-400/20 text-orange-200">
                    <FlaskConical className="h-3 w-3 inline mr-1" />
                    Essai {joursEssai}j
                  </span>
                )}
              </div>
              <p className="text-blue-200 text-sm">{employe.poste}{employe.departement ? ` · ${employe.departement}` : ""}</p>
              <p className="text-blue-300 text-xs mt-0.5">Matricule {employe.matricule}</p>

              {/* Contacts */}
              <div className="flex flex-wrap gap-4 mt-4">
                {employe.email && (
                  <a href={`mailto:${employe.email}`} className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors">
                    <Mail className="h-3.5 w-3.5" />{employe.email}
                  </a>
                )}
                {employe.telephone && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-200">
                    <Phone className="h-3.5 w-3.5" />{employe.telephone}
                  </span>
                )}
                {employe.adresse && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-200">
                    <MapPin className="h-3.5 w-3.5" />{employe.adresse}
                  </span>
                )}
              </div>
            </div>

            {/* Score évaluation */}
            {derniereEval && (
              <div className="flex-shrink-0 text-center">
                <div
                  className="h-14 w-14 rounded-2xl flex flex-col items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  <span className="text-xl font-black text-white">{derniereEval.scoreGlobal.toFixed(1)}</span>
                  <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                </div>
                <p className="text-xs text-blue-300 mt-1">Évaluation</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
          {[
            { label: "Ancienneté",   value: anciennete,                   icon: Clock },
            { label: "Contrat",      value: employe.typeContrat,          icon: Briefcase },
            { label: "Salaire base", value: formatCurrency(employe.salaireBase), icon: DollarSign },
            { label: "Congés pris",  value: `${congesApprouves} congé(s)`,icon: Calendar },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-6 py-4 border-r border-white/10 last:border-0">
              <s.icon className="h-4 w-4 text-blue-300 flex-shrink-0" />
              <div>
                <p className="text-xs text-blue-400">{s.label}</p>
                <p className="text-sm font-semibold text-white">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Corps ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Colonne principale */}
        <div className="col-span-1 lg:col-span-2 space-y-5">

          {/* Infos personnelles */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">Informations personnelles</span>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: "Date de naissance",  value: employe.dateNaissance ? `${formatDate(employe.dateNaissance)}${employe.lieuNaissance ? ` · ${employe.lieuNaissance}` : ""}` : null },
                { label: "Nationalité",         value: employe.nationalite },
                { label: "N° CNI / Passeport", value: employe.numeroCni },
                { label: "Date d'embauche",     value: formatDate(employe.dateEmbauche) },
                { label: "Fin de contrat",      value: employe.dateFinContrat ? formatDate(employe.dateFinContrat) : "Indéterminé" },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-xs text-slate-400 mb-0.5">{f.label}</p>
                  <p className="text-sm font-medium text-slate-800">{f.value}</p>
                </div>
              ))}
              {employe.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{employe.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Congés */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-slate-900 text-sm">Congés & Absences</span>
              </div>
              <Link href="/conges" className="text-xs text-blue-600 hover:underline">Gérer →</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {employe.conges.length === 0 ? (
                <p className="text-sm text-slate-400 px-6 py-5">Aucun congé enregistré</p>
              ) : (
                employe.conges.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="text-sm font-medium text-slate-700">{c.type}</span>
                      <span className="text-xs text-slate-400 ml-2">{formatDate(c.dateDebut)} → {formatDate(c.dateFin)} · <strong>{c.nbJours}j</strong></span>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      c.statut === "APPROUVE" ? "bg-green-100 text-green-700" :
                      c.statut === "REFUSE"   ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"}`}>
                      {c.statut}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dossiers disciplinaires */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-slate-900 text-sm">Dossiers disciplinaires</span>
                {employe.dossiersDisciplinaires.filter(d => d.statut === "EN_COURS").length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-semibold rounded-full px-2 py-0.5">
                    {employe.dossiersDisciplinaires.filter(d => d.statut === "EN_COURS").length} en cours
                  </span>
                )}
              </div>
              <Link href="/disciplinaire" className="text-xs text-blue-600 hover:underline">Gérer →</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {employe.dossiersDisciplinaires.length === 0 ? (
                <p className="text-sm text-slate-400 px-6 py-5">Aucun dossier disciplinaire</p>
              ) : (
                employe.dossiersDisciplinaires.map(d => (
                  <div key={d.id} className="flex items-start justify-between px-6 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{d.motif}</span>
                        <span className="text-xs text-slate-400">{formatDate(d.date)}</span>
                      </div>
                      <span className="text-xs text-slate-500">{d.type.replace(/_/g, " ")}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      d.statut === "CLOS" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"}`}>
                      {d.statut}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Colonne droite */}
        <div className="space-y-5">

          {/* Période d'essai */}
          {employe.periodeEssai && employe.dateFinEssai && (
            <div
              className="rounded-xl border p-5"
              style={{
                background: essaiActif ? (joursEssai <= 7 ? "#fef2f2" : "#fff7ed") : "#f8fafc",
                borderColor: essaiActif ? (joursEssai <= 7 ? "#fecaca" : "#fed7aa") : "#e2e8f0",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="h-4 w-4" style={{ color: essaiActif ? (joursEssai <= 7 ? "#ef4444" : "#f97316") : "#94a3b8" }} />
                <span className="text-sm font-semibold" style={{ color: essaiActif ? (joursEssai <= 7 ? "#dc2626" : "#c2410c") : "#64748b" }}>
                  {essaiActif ? (joursEssai <= 7 ? `Essai — ${joursEssai} jour(s) restant(s)` : "En période d'essai") : "Essai terminé"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Du {formatDate(employe.dateDebutEssai)} au {formatDate(employe.dateFinEssai)}
              </p>
            </div>
          )}

          {/* Salaires */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold text-slate-900 text-sm">Salaires</span>
              </div>
              <Link href="/salaires" className="text-xs text-blue-600 hover:underline">Historique →</Link>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-400 mb-1">Salaire de base</p>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(employe.salaireBase)}</p>
              <div className="mt-4 space-y-2">
                {employe.historiqueSalaires.slice(0, 4).map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{MOIS[s.mois - 1]} {s.annee}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">{formatCurrency(s.netAPayer)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {s.statut}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Évaluations */}
          {employe.evaluations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Star className="h-4 w-4 text-purple-500" />
                <span className="font-semibold text-slate-900 text-sm">Évaluations</span>
              </div>
              <div className="p-5 space-y-3">
                {employe.evaluations.map(ev => {
                  const color = ev.scoreGlobal >= 4 ? "#10b981" : ev.scoreGlobal >= 3 ? "#f59e0b" : "#ef4444"
                  const bg    = ev.scoreGlobal >= 4 ? "#ecfdf5" : ev.scoreGlobal >= 3 ? "#fffbeb" : "#fef2f2"
                  return (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: bg, color }}>
                        {ev.scoreGlobal.toFixed(1)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ev.periode}</p>
                        <p className="text-xs text-slate-400">{formatDate(ev.dateEval)} · {ev.evaluateur}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Accès espace employé */}
          <CompteAccessPanel
            employeId={employe.id}
            compte={employe.utilisateur
              ? { id: employe.utilisateur.id, email: employe.utilisateur.email, createdAt: employe.utilisateur.createdAt.toISOString() }
              : null
            }
          />

        </div>
      </div>
    </div>
  )
}
