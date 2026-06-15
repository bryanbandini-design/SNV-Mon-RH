import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { auth } from "@/auth"
import {
  Users, Calendar, AlertTriangle, DollarSign, Clock,
  FlaskConical, Plus, ArrowRight, TrendingUp, UserCheck,
  CheckCircle, AlertCircle,
} from "lucide-react"
import { formatCurrency, formatDate, MOIS } from "@/lib/utils"
import { DashboardCharts } from "@/components/dashboard/charts"
import { DashboardRefresh } from "@/components/dashboard/refresh"

export default async function DashboardPage() {
  const session = await auth()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const prenom = session?.user?.name?.split(" ")[0] ?? "Admin"

  const [
    totalActifs,
    congesEnAttente,
    disciplinairesEnCours,
    salairesMois,
    presencesAujourdhui,
    evaluations,
    employes,
    essaisExpiration,
    congesApprouves,
  ] = await Promise.all([
    prisma.employe.count({ where: { statut: "ACTIF" } }),
    prisma.conge.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.dossierDisciplinaire.count({ where: { statut: "EN_COURS" } }),
    prisma.historiqueSalaire.aggregate({
      where: { mois: currentMonth, annee: currentYear },
      _sum: { netAPayer: true },
    }),
    prisma.presence.count({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt:  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
    }),
    prisma.evaluation.findMany({
      orderBy: { dateEval: "desc" },
      take: 5,
      include: { employe: { select: { prenom: true, nom: true, poste: true } } },
    }),
    prisma.employe.findMany({
      where: { statut: "ACTIF" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { dossiersDisciplinaires: true } } },
    }),
    prisma.employe.count({
      where: {
        periodeEssai: true,
        dateFinEssai: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.conge.count({ where: { statut: "APPROUVE", dateFin: { gte: now } } }),
  ])

  // Masse salariale 6 mois
  const moisGraphique: { mois: string; montant: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    const m = d.getMonth() + 1
    const a = d.getFullYear()
    const agg = await prisma.historiqueSalaire.aggregate({
      where: { mois: m, annee: a },
      _sum: { netAPayer: true },
    })
    moisGraphique.push({ mois: MOIS[m - 1].slice(0, 3), montant: agg._sum.netAPayer ?? 0 })
  }

  // Présences semaine
  const lundi = new Date(now)
  lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  lundi.setHours(0, 0, 0, 0)
  const presencesSemaine = await prisma.presence.groupBy({
    by: ["statut"],
    where: { date: { gte: lundi } },
    _count: { statut: true },
  })
  const statsPresence = {
    PRESENT: presencesSemaine.find(p => p.statut === "PRESENT")?._count.statut ?? 0,
    RETARD:  presencesSemaine.find(p => p.statut === "RETARD")?._count.statut ?? 0,
    ABSENT:  presencesSemaine.find(p => p.statut === "ABSENT")?._count.statut ?? 0,
  }

  // Contrats
  const contratsRaw = await prisma.employe.groupBy({
    by: ["typeContrat"],
    where: { statut: "ACTIF" },
    _count: { typeContrat: true },
  })
  const contrats = contratsRaw.map(c => ({ name: c.typeContrat, value: c._count.typeContrat }))

  const netMois = salairesMois._sum.netAPayer ?? 0
  const hasAlerts = congesEnAttente > 0 || disciplinairesEnCours > 0 || essaisExpiration > 0

  const kpis = [
    {
      label: "Employés actifs",
      value: totalActifs.toString(),
      sub: `${congesApprouves} en congé actuellement`,
      icon: Users,
      accent: "#3b82f6",
      bg: "#eff6ff",
      href: "/employes",
    },
    {
      label: "Congés en attente",
      value: congesEnAttente.toString(),
      sub: congesEnAttente === 0 ? "Tout est validé" : "à valider",
      icon: Calendar,
      accent: "#f59e0b",
      bg: "#fffbeb",
      href: "/conges",
      alert: congesEnAttente > 0,
    },
    {
      label: "Dossiers disciplinaires",
      value: disciplinairesEnCours.toString(),
      sub: disciplinairesEnCours === 0 ? "Aucun en cours" : "en cours",
      icon: AlertTriangle,
      accent: "#ef4444",
      bg: "#fef2f2",
      href: "/disciplinaire",
      alert: disciplinairesEnCours > 0,
    },
    {
      label: `Masse salariale ${MOIS[currentMonth - 1]}`,
      value: netMois > 0 ? formatCurrency(netMois) : "—",
      sub: netMois === 0 ? "Aucune fiche ce mois" : `${currentYear}`,
      icon: DollarSign,
      accent: "#10b981",
      bg: "#ecfdf5",
      href: "/salaires",
    },
    {
      label: "Pointages aujourd'hui",
      value: presencesAujourdhui.toString(),
      sub: `sur ${totalActifs} actifs`,
      icon: Clock,
      accent: "#8b5cf6",
      bg: "#f5f3ff",
      href: "/horaires",
    },
    {
      label: "Essais expirant",
      value: essaisExpiration.toString(),
      sub: "dans les 7 prochains jours",
      icon: FlaskConical,
      accent: "#f97316",
      bg: "#fff7ed",
      href: "/employes",
      alert: essaisExpiration > 0,
    },
  ]

  return (
    <div className="space-y-7">

      {/* ── En-tête ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-500 text-sm mb-0.5">
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Bonjour, <span style={{ color: "#3b82f6" }}>{prenom}</span> 👋
          </h1>
        </div>
        <DashboardRefresh />
      </div>

      {/* ── Alertes actives ─────────────────────────── */}
      {hasAlerts && (
        <div
          className="rounded-xl border px-4 py-3 flex items-start gap-3 anim-fade-up"
          style={{ background: "#fffbeb", borderColor: "#fde68a" }}
        >
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#92400e" }}>Actions requises</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {congesEnAttente > 0 && (
                <Link href="/conges" className="text-sm hover:underline" style={{ color: "#b45309" }}>
                  · {congesEnAttente} congé(s) à valider
                </Link>
              )}
              {disciplinairesEnCours > 0 && (
                <Link href="/disciplinaire" className="text-sm hover:underline" style={{ color: "#b45309" }}>
                  · {disciplinairesEnCours} dossier(s) en cours
                </Link>
              )}
              {essaisExpiration > 0 && (
                <Link href="/employes" className="text-sm hover:underline" style={{ color: "#b45309" }}>
                  · {essaisExpiration} essai(s) expirant bientôt
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map((k, i) => (
          <Link
            key={k.label}
            href={k.href}
            className={`block rounded-xl border bg-white group card-hover anim-fade-up anim-delay-${i + 1}`}
            style={{ borderColor: k.alert ? k.accent + "60" : "#e2e8f0", borderTopWidth: "3px", borderTopColor: k.accent }}
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{k.label}</p>
                  <p className="text-3xl font-black text-slate-900 leading-none">{k.value}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{k.sub}</p>
                </div>
                <div className="rounded-xl p-2.5 flex-shrink-0" style={{ background: k.bg }}>
                  <k.icon className="h-5 w-5" style={{ color: k.accent }} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: k.accent }}>
                Voir le détail <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Graphiques ──────────────────────────────── */}
      <DashboardCharts
        salairesMois={moisGraphique}
        statsPresence={statsPresence}
        contrats={contrats}
      />

      {/* ── Bas de page ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Équipe */}
        <div className="col-span-1 xl:col-span-3 rounded-xl border border-slate-200 bg-white overflow-hidden anim-fade-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" style={{ color: "#3b82f6" }} />
              <span className="font-semibold text-slate-900 text-sm">Équipe active</span>
              <span className="text-xs bg-blue-50 text-blue-600 font-medium rounded-full px-2 py-0.5">{totalActifs}</span>
            </div>
            <Link href="/employes" className="text-xs font-medium hover:underline" style={{ color: "#3b82f6" }}>
              Voir tous →
            </Link>
          </div>
          {employes.length === 0 ? (
            <div className="text-center py-14 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucun employé</p>
              <Link href="/employes/nouveau" className="text-sm font-medium mt-2 inline-block" style={{ color: "#3b82f6" }}>
                Ajouter le premier employé →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {employes.map((emp) => (
                <Link key={emp.id} href={`/employes/${emp.id}`}>
                  <div className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors group">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, #3b82f6, #6366f1)` }}
                    >
                      {emp.prenom[0]}{emp.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{emp.prenom} {emp.nom}</p>
                      <p className="text-xs text-slate-400 truncate">{emp.poste}{emp.departement ? ` · ${emp.departement}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs border border-slate-200 text-slate-500 rounded-full px-2 py-0.5">{emp.typeContrat}</span>
                      {emp._count.dossiersDisciplinaires > 0 && (
                        <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">⚠️ {emp._count.dossiersDisciplinaires}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Colonne droite */}
        <div className="col-span-1 xl:col-span-2 flex flex-col gap-4">

          {/* Actions rapides */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden anim-fade-up anim-delay-2">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">Actions rapides</p>
            </div>
            <div className="p-3 space-y-1.5">
              {[
                { label: "Nouvel employé",      href: "/employes/nouveau",  color: "#3b82f6", bg: "#eff6ff" },
                { label: "Demande de congé",     href: "/conges",            color: "#f59e0b", bg: "#fffbeb" },
                { label: "Fiche de salaire",     href: "/salaires",          color: "#10b981", bg: "#ecfdf5" },
                { label: "Nouvelle évaluation",  href: "/evaluations",       color: "#8b5cf6", bg: "#f5f3ff" },
                { label: "Saisir une présence",  href: "/horaires",          color: "#6366f1", bg: "#eef2ff" },
              ].map(a => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:opacity-90 transition-all group"
                  style={{ background: a.bg }}
                >
                  <div className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: a.color }}>
                    <Plus className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium flex-1" style={{ color: a.color }}>{a.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: a.color }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Dernières évaluations */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden anim-fade-up anim-delay-3 flex-1">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: "#8b5cf6" }} />
                <span className="font-semibold text-slate-900 text-sm">Évaluations</span>
              </div>
              <Link href="/evaluations" className="text-xs font-medium hover:underline" style={{ color: "#8b5cf6" }}>
                Voir toutes →
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {evaluations.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Aucune évaluation</p>
                </div>
              ) : (
                evaluations.map((ev) => {
                  const score = ev.scoreGlobal
                  const color = score >= 4 ? "#10b981" : score >= 3 ? "#f59e0b" : "#ef4444"
                  const bg    = score >= 4 ? "#ecfdf5" : score >= 3 ? "#fffbeb" : "#fef2f2"
                  return (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: bg, color }}
                      >
                        {score.toFixed(1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {ev.employe.prenom} {ev.employe.nom}
                        </p>
                        <p className="text-xs text-slate-400">{ev.periode} · {formatDate(ev.dateEval)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
