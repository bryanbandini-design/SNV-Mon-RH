import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatCurrency, formatDate, MOIS } from "@/lib/utils"
import { Calendar, DollarSign, Star, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, FolderOpen } from "lucide-react"

export default async function MonEspacePage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId as string | null
  if (!employeId) redirect("/login")

  const employe = await prisma.employe.findUnique({
    where: { id: employeId },
    include: {
      conges:            { orderBy: { createdAt: "desc" }, take: 3 },
      historiqueSalaires: { orderBy: [{ annee: "desc" }, { mois: "desc" }], take: 1 },
      evaluations:       { orderBy: { dateEval: "desc" }, take: 1 },
      affectationsShift: {
        where: { dateFin: { gte: new Date() } },
        include: { shift: true },
        orderBy: { dateDebut: "asc" },
        take: 1,
      },
    },
  })
  if (!employe) redirect("/login")

  const dernierSalaire  = employe.historiqueSalaires[0]
  const derniereEval    = employe.evaluations[0]
  const prochaineAffect = employe.affectationsShift[0]
  const congesEnAttente = employe.conges.filter(c => c.statut === "EN_ATTENTE").length
  const congesApprouves = employe.conges.filter(c => c.statut === "APPROUVE").length

  const nbDocuments = await prisma.document.count({
    where: { employeId, dossierDisciplinaireId: null },
  })

  const now = new Date()
  const diffMois = Math.floor((now.getTime() - new Date(employe.dateEmbauche).getTime()) / (1000 * 60 * 60 * 24 * 30))
  const anciennete = diffMois >= 12 ? `${Math.floor(diffMois / 12)} an(s)` : `${diffMois} mois`

  return (
    <div className="space-y-6">

      {/* ── Bienvenue ──────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)" }}>
        <div className="px-5 py-6 sm:px-8 sm:py-7">
          <p className="text-emerald-300 text-sm mb-1">Bonjour,</p>
          <h1 className="text-3xl font-black text-white">{employe.prenom} {employe.nom}</h1>
          <p className="text-emerald-200 mt-1">{employe.poste}{employe.departement ? ` · ${employe.departement}` : ""}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
          {[
            { label: "Ancienneté",   value: anciennete             },
            { label: "Contrat",      value: employe.typeContrat    },
            { label: "Matricule",    value: employe.matricule      },
            { label: "Salaire base", value: formatCurrency(employe.salaireBase) },
          ].map((s, i) => (
            <div key={i} className="px-4 py-3 sm:px-6 sm:py-4 border-r border-white/10 last:border-0 even:border-r-0 sm:even:border-r border-b sm:border-b-0 border-white/10">
              <p className="text-emerald-400 text-xs">{s.label}</p>
              <p className="text-white font-semibold text-sm mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alertes ────────────────────────────── */}
      {congesEnAttente > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">{congesEnAttente} demande(s) de congé en attente de validation</p>
        </div>
      )}

      {/* ── Widgets ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">

        {/* Dernier bulletin */}
        <Link href="/mon-espace/salaires" className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Dernier bulletin</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          {dernierSalaire ? (
            <div>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(dernierSalaire.netAPayer)}</p>
              <p className="text-xs text-slate-400 mt-1">{MOIS[dernierSalaire.mois - 1]} {dernierSalaire.annee}</p>
              <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                dernierSalaire.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>{dernierSalaire.statut}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucun bulletin disponible</p>
          )}
        </Link>

        {/* Congés */}
        <Link href="/mon-espace/conges" className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Calendar className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Mes congés</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="space-y-2">
            {[
              { label: "Approuvés",   value: congesApprouves, color: "text-green-600"  },
              { label: "En attente",  value: congesEnAttente,  color: "text-amber-600"  },
              { label: "Total soumis", value: employe.conges.length, color: "text-slate-700" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{s.label}</span>
                <span className={`font-bold text-sm ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </Link>

        {/* Mon planning */}
        <Link href="/mon-espace/planning" className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Clock className="h-4.5 w-4.5 text-indigo-600" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Mon planning</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          {prochaineAffect ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: prochaineAffect.shift.couleur }} />
                <p className="font-semibold text-slate-900 text-sm">{prochaineAffect.shift.nom}</p>
              </div>
              <p className="text-sm font-mono text-slate-700">{prochaineAffect.shift.heureDebut} → {prochaineAffect.shift.heureFin}</p>
              <p className="text-xs text-slate-400 mt-1">
                Du {formatDate(prochaineAffect.dateDebut)} au {formatDate(prochaineAffect.dateFin)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune affectation à venir</p>
          )}
        </Link>

        {/* Mes documents */}
        <Link href="/mon-espace/documents" className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center">
                <FolderOpen className="h-4.5 w-4.5 text-sky-600" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Mes documents</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          {nbDocuments > 0 ? (
            <div>
              <p className="text-2xl font-black text-slate-900">{nbDocuments}</p>
              <p className="text-xs text-slate-400 mt-1">document(s) disponible(s)</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucun document partagé</p>
          )}
        </Link>

        {/* Dernière évaluation */}
        <Link href="/mon-espace/evaluations" className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center">
                <Star className="h-4.5 w-4.5 text-purple-600" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Dernière évaluation</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          {derniereEval ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full flex items-center justify-center font-black text-lg"
                  style={{
                    background: derniereEval.scoreGlobal >= 4 ? "#ecfdf5" : derniereEval.scoreGlobal >= 3 ? "#fffbeb" : "#fef2f2",
                    color:      derniereEval.scoreGlobal >= 4 ? "#10b981" : derniereEval.scoreGlobal >= 3 ? "#f59e0b" : "#ef4444",
                  }}>
                  {derniereEval.scoreGlobal.toFixed(1)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{derniereEval.periode}</p>
                  <p className="text-xs text-slate-400">{formatDate(derniereEval.dateEval)}</p>
                  <p className="text-xs text-slate-500">par {derniereEval.evaluateur}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune évaluation disponible</p>
          )}
        </Link>
      </div>

      {/* ── Dernières demandes congés ───────────── */}
      {employe.conges.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="font-semibold text-slate-900 text-sm">Mes dernières demandes</p>
            <Link href="/mon-espace/conges" className="text-xs text-emerald-600 hover:underline">Tout voir →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {employe.conges.map(c => (
              <div key={c.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.type}</p>
                  <p className="text-xs text-slate-400">{formatDate(c.dateDebut)} → {formatDate(c.dateFin)} · <strong>{c.nbJours}j</strong></p>
                </div>
                <div className="flex items-center gap-2">
                  {c.statut === "APPROUVE"   && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {c.statut === "REFUSE"     && <XCircle     className="h-4 w-4 text-red-500"   />}
                  {c.statut === "EN_ATTENTE" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    c.statut === "APPROUVE" ? "bg-green-100 text-green-700" :
                    c.statut === "REFUSE"   ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"}`}>{c.statut.replace("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
