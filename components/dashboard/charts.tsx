"use client"

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts"
import { DollarSign, Activity, Briefcase } from "lucide-react"

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"]

interface Props {
  salairesMois:  { mois: string; montant: number }[]
  statsPresence: { PRESENT: number; RETARD: number; ABSENT: number }
  contrats:      { name: string; value: number }[]
}

function formatK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-slate-600">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-slate-400">FCFA</span>
      </p>
    </div>
  )
}

export function DashboardCharts({ salairesMois, statsPresence, contrats }: Props) {
  const presenceData = [
    { name: "Présents", value: statsPresence.PRESENT, color: "#10b981" },
    { name: "Retards",  value: statsPresence.RETARD,  color: "#f59e0b" },
    { name: "Absents",  value: statsPresence.ABSENT,  color: "#ef4444" },
  ].filter(d => d.value > 0)

  const hasSalaires = salairesMois.some(m => m.montant > 0)
  const hasPresence = presenceData.length > 0
  const hasContrats = contrats.length > 0
  const totalPresence = presenceData.reduce((a, d) => a + d.value, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* ── Masse salariale ─────────────────────────── */}
      <div className="col-span-1 lg:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden anim-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#ecfdf5" }}>
              <DollarSign className="h-4 w-4" style={{ color: "#10b981" }} />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Masse salariale — 6 derniers mois</span>
          </div>
        </div>
        <div className="px-2 pt-4 pb-2">
          {!hasSalaires ? (
            <div className="h-52 flex flex-col items-center justify-center text-slate-300 gap-3">
              <DollarSign className="h-10 w-10 opacity-30" />
              <p className="text-sm text-slate-400">Aucune fiche de salaire ce semestre</p>
              <a href="/salaires" className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: "#ecfdf5", color: "#10b981" }}>
                Créer une fiche →
              </a>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={salairesMois} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="mois"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={formatK}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false} tickLine={false}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="montant"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#salGrad)"
                  dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Colonne droite ──────────────────────────── */}
      <div className="flex flex-col gap-4">

        {/* Présences */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden anim-fade-up anim-delay-1">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#eff6ff" }}>
              <Activity className="h-4 w-4" style={{ color: "#3b82f6" }} />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Présences semaine</span>
          </div>
          <div className="p-4">
            {!hasPresence ? (
              <div className="py-6 flex flex-col items-center text-slate-300 gap-2">
                <Activity className="h-8 w-8 opacity-30" />
                <p className="text-xs text-slate-400 text-center">Aucun pointage cette semaine</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ResponsiveContainer width={88} height={88}>
                    <PieChart>
                      <Pie
                        data={presenceData}
                        dataKey="value"
                        cx="50%" cy="50%"
                        innerRadius={28} outerRadius={42}
                        strokeWidth={0}
                      >
                        {presenceData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-700">{totalPresence}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {presenceData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-slate-600 flex-1">{d.name}</span>
                      <span className="text-xs font-bold text-slate-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Répartition contrats */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden anim-fade-up anim-delay-2 flex-1">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#f5f3ff" }}>
              <Briefcase className="h-4 w-4" style={{ color: "#8b5cf6" }} />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Répartition contrats</span>
          </div>
          <div className="p-4 space-y-3">
            {!hasContrats ? (
              <div className="py-4 flex items-center justify-center text-slate-400 text-xs">
                Aucun employé actif
              </div>
            ) : (
              contrats.map((c, i) => {
                const total = contrats.reduce((a, x) => a + x.value, 0)
                const pct = Math.round((c.value / total) * 100)
                const color = COLORS[i % COLORS.length]
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-medium">{c.name}</span>
                      <span className="text-slate-500">{c.value} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
