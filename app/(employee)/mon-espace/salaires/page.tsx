"use client"

import { useState, useEffect } from "react"
import { DollarSign, Download, AlertCircle } from "lucide-react"
import { formatCurrency, MOIS } from "@/lib/utils"

type Employe = { prenom: string; nom: string; matricule: string; poste: string; salaireBase: number }
type Salaire = {
  id: string; mois: number; annee: number
  salaireBase: number; primes: number; retenues: number; netAPayer: number
  statut: string; datePaiement: string | null; notes: string | null
}
type Retenue = {
  id: string; type: string; date: string; montant: number; description: string; statut: string
  presence: { minutesRetard: number; statut: string } | null
}

export default function MesSalairesPage() {
  const [employe,  setEmploye]  = useState<Employe | null>(null)
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [retenues, setRetenues] = useState<Retenue[]>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/mon-espace/salaires").then(r => r.ok ? r.json() : null),
      fetch("/api/mon-espace/retenues").then(r => r.ok ? r.json() : []),
    ]).then(([data, ret]) => {
      if (data) { setEmploye(data.employe); setSalaires(data.salaires) }
      if (Array.isArray(ret)) setRetenues(ret)
    })
  }, [])

  function handleDownload(s: Salaire) {
    const isCapacitor = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    if (isCapacitor) {
      window.location.href = `/print/bulletin/${s.id}`
    } else {
      window.open(`/print/bulletin/${s.id}`, "_blank")
    }
  }

  const totalPaye = salaires.filter(s => s.statut === "PAYE").reduce((a, s) => a + s.netAPayer, 0)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes salaires</h1>
        <p className="text-sm text-slate-500 mt-1">Historique et téléchargement de vos bulletins de paie</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Salaire de base",  value: employe ? formatCurrency(employe.salaireBase) : "—", color: "text-slate-900" },
          { label: "Total perçu",      value: formatCurrency(totalPaye),                             color: "text-emerald-700" },
          { label: "Bulletins",        value: `${salaires.length} mois`,                             color: "text-slate-700" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Retenues */}
      {retenues.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="font-semibold text-slate-900 text-sm">Retenues absences &amp; retards</p>
            {retenues.some(r => r.statut === "EN_ATTENTE") && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {retenues.filter(r => r.statut === "EN_ATTENTE").length} en attente de validation
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {retenues.map(r => {
              const dateLabel = new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type === "ABSENCE" ? "bg-red-100" : "bg-orange-100"}`}>
                    <AlertCircle className={`h-4 w-4 ${r.type === "ABSENCE" ? "text-red-500" : "text-orange-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.type === "ABSENCE" ? "Absence" : "Retard"} · {dateLabel}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-red-600">−{r.montant.toLocaleString("fr-FR")} FCFA</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.statut === "EN_ATTENTE" ? "bg-amber-100 text-amber-700" :
                      r.statut === "VALIDEE"    ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {r.statut === "EN_ATTENTE" ? "En attente" : r.statut === "VALIDEE" ? "Confirmée" : "Annulée"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Liste des bulletins */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900 text-sm">Bulletins de paie</p>
        </div>
        {salaires.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucun bulletin disponible</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {salaires.map(s => {
              const ajust = s.primes - s.retenues
              return (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{MOIS[s.mois - 1]} {s.annee}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Base {formatCurrency(s.salaireBase)}
                      {ajust !== 0 && (
                        <span style={{ color: ajust > 0 ? "#10b981" : "#ef4444" }}>
                          {" "}{ajust > 0 ? "+" : ""}{formatCurrency(ajust)}
                        </span>
                      )}
                      {s.notes && <span className="italic text-slate-400"> · {s.notes}</span>}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-base font-black text-slate-900">{formatCurrency(s.netAPayer)}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.statut === "PAYE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>{s.statut === "PAYE" ? "Payé" : "En attente"}</span>
                  </div>
                  <button
                    onClick={() => handleDownload(s)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-700 transition-all flex-shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
