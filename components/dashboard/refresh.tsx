"use client"

import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { useState } from "react"

export function DashboardRefresh() {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)

  function refresh() {
    setSpinning(true)
    router.refresh()
    setTimeout(() => setSpinning(false), 1000)
  }

  return (
    <button
      onClick={refresh}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
      Rafraîchir
    </button>
  )
}
