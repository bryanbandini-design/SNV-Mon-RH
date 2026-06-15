import Link from "next/link"
import { Search, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <Search className="h-8 w-8 text-slate-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Page introuvable</h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        La ressource demandée n&apos;existe pas ou a été supprimée.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
      >
        <Home className="h-4 w-4" />
        Retour au tableau de bord
      </Link>
    </div>
  )
}
