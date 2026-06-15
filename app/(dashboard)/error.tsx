"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error)
  }, [error])

  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Une erreur est survenue</h1>
      <p className="text-sm text-slate-500 max-w-sm mb-2">
        {error.message || "Cette page a rencontré un problème inattendu."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 font-mono mb-6">Code : {error.digest}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50"
        >
          <Home className="h-4 w-4" />
          Tableau de bord
        </button>
      </div>
    </div>
  )
}
