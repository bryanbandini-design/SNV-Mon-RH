"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, Lock, Mail } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError("Email ou mot de passe incorrect")
    } else {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f1f5f9" }}>

      {/* ── Panneau gauche (branding) ─────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-white text-base"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            RH
          </div>
          <span className="text-white font-bold text-lg">Mon RH</span>
        </div>

        {/* Illustration texte */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white leading-snug">
              Gérez votre équipe<br />en toute simplicité
            </h1>
            <p className="text-blue-200 mt-3 text-sm leading-relaxed">
              Employés, congés, salaires, évaluations et horaires — tout centralisé dans une plateforme pensée pour les petites entreprises.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "Dossiers employés complets",
              "Gestion congés & absences",
              "Suivi disciplinaire",
              "Fiches de salaire & paie",
              "Évaluations de performance",
              "Registre numérique des présences",
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-blue-100">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-400 text-xs">© 2026 Mon RH · Gestion des Ressources Humaines</p>
      </div>

      {/* ── Panneau droit (formulaire) ────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-white text-base"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
            >
              RH
            </div>
            <span className="text-slate-900 font-bold text-lg">Mon RH</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Connexion</h2>
            <p className="text-slate-500 text-sm mt-1">Accédez à votre espace de gestion RH</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@monrh.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#fef2f2", color: "#dc2626" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: loading ? "#64748b" : "linear-gradient(135deg, #3b82f6, #6366f1)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="mt-6 p-3 rounded-lg border border-slate-200 bg-white text-center">
            <p className="text-xs text-slate-500">Compte par défaut</p>
            <p className="text-xs font-mono text-slate-700 mt-1">admin@monrh.com · admin123</p>
          </div>

        </div>
      </div>

    </div>
  )
}
