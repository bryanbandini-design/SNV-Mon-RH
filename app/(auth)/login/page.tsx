"use client"

import { useState, useEffect, useCallback } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Page de connexion
// Phase "form"       → formulaire normal
// Phase "connecting" → écran d'animation plein page (remplace toute la page)
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState("")
  const [phase,    setPhase]    = useState<"form" | "connecting">("form")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // 1. Bascule immédiatement sur l'écran d'animation
    setPhase("connecting")

    // 2. Attend 2 frames → React a le temps de peindre le nouvel écran
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

    // 3. Auth
    try {
      const result = await signIn("credentials", { email, password, redirect: false })

      if (result?.error) {
        setPhase("form")
        setError("Email ou mot de passe incorrect")
        return
      }

      // 4. Succès → page bienvenue
      router.push("/bienvenue")
    } catch {
      setPhase("form")
      setError("Erreur de connexion. Veuillez réessayer.")
    }
  }

  // ── Écran animation "Connexion en cours" ──────────────────────────────────
  if (phase === "connecting") {
    return <ConnectingScreen />
  }

  // ── Formulaire ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ background: "#f1f5f9" }}>

      {/* Panneau gauche */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sanovia.png" alt="SANOVIA Health Care"
            style={{ height: "40px", width: "auto", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.3))" }} />
        </div>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white leading-snug">
              Gérez votre équipe<br />en toute simplicité
            </h1>
            <p className="text-blue-200 mt-3 text-sm leading-relaxed">
              Employés, congés, salaires, évaluations et horaires — tout centralisé
              dans une plateforme pensée pour les petites entreprises.
            </p>
          </div>
          <div className="space-y-3">
            {["Dossiers employés complets","Gestion congés & absences","Suivi disciplinaire",
              "Fiches de salaire & paie","Évaluations de performance","Registre numérique des présences",
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

      {/* Panneau droit */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          <div className="lg:hidden flex items-center justify-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-sanovia.png" alt="SANOVIA Health Care" style={{ height: "36px", width: "auto" }} />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Connexion</h2>
            <p className="text-slate-500 text-sm mt-1">Accédez à votre espace de gestion RH</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Identifiant ou email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input id="email" type="text" placeholder="nom_utilisateur ou email@..."
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="pl-10" required autoFocus autoComplete="username" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm animate-in fade-in"
                style={{ background: "#fef2f2", color: "#dc2626" }}>
                {error}
              </div>
            )}

            <button type="submit"
              className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-all flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              Se connecter
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

// ─────────────────────────────────────────────────────────────────────────────
// Écran "Connexion en cours"
// ─────────────────────────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id:    i,
  left:  `${(i * 43 + 7) % 96}%`,
  top:   `${(i * 37 + 11) % 94}%`,
  size:  (i % 4) + 3,
  color: ["38bdf8","60a5fa","818cf8","a78bfa","7dd3fc"][i % 5],
  dur:   `${3.5 + (i % 5) * 0.7}s`,
  delay: `${(i % 7) * 0.45}s`,
  op:    0.18 + (i % 4) * 0.09,
}))

function ConnectingScreen() {
  const [dot, setDot] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setDot(d => (d + 1) % 3), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes _fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes _popIn   { 0%{opacity:0;transform:scale(0.55)} 65%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1)} }
        @keyframes _ring    { 0%{transform:scale(1);opacity:0.55} 100%{transform:scale(2.2);opacity:0} }
        @keyframes _shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes _float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
        @keyframes _slideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{
        position:"fixed", inset:0, zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"linear-gradient(135deg,#020817 0%,#0c1a3d 45%,#0f2560 100%)",
        animation:"_fadeIn 0.2s ease forwards",
        overflow:"hidden",
      }}>

        {/* Orbes */}
        <div style={{ position:"absolute",top:"-8%",left:"-4%",width:580,height:580,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(14,165,233,0.28) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:"-10%",right:"-5%",width:500,height:500,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(129,140,248,0.22) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"absolute",top:"40%",left:"48%",transform:"translate(-50%,-50%)",
          width:380,height:380,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(56,189,248,0.1) 0%,transparent 70%)",pointerEvents:"none" }} />

        {/* Particules */}
        {PARTICLES.map(p => (
          <div key={p.id} style={{
            position:"absolute", left:p.left, top:p.top,
            width:p.size, height:p.size, borderRadius:"50%",
            background:`#${p.color}`, opacity:p.op,
            animation:`_float ${p.dur} ease-in-out ${p.delay} infinite`,
            pointerEvents:"none",
          }} />
        ))}

        {/* Contenu centré */}
        <div style={{ position:"relative",zIndex:10,textAlign:"center",
          display:"flex",flexDirection:"column",alignItems:"center",padding:"52px 64px" }}>

          {/* Logo SANOVIA + anneaux */}
          <div style={{ position:"relative",marginBottom:36,
            animation:"_popIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
            {[0, 0.55, 1.1].map((d, i) => (
              <div key={i} style={{
                position:"absolute", inset:-(14+i*12), borderRadius:20+i*4,
                border:`1.5px solid rgba(56,189,248,${0.5-i*0.13})`,
                animation:`_ring 2.5s ease-out ${d}s infinite`, pointerEvents:"none",
              }} />
            ))}
            <div style={{
              borderRadius:20,
              background:"white",
              padding:"12px 20px",
              boxShadow:"0 0 50px rgba(56,189,248,0.5),0 10px 40px rgba(0,0,0,0.5)",
              border:"1px solid rgba(255,255,255,0.3)",
              overflow:"hidden", position:"relative",
            }}>
              {/* shimmer */}
              <div style={{ position:"absolute",inset:0,
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)",
                backgroundSize:"400px 100%",animation:"_shimmer 1.8s linear infinite" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-sanovia.png" alt="SANOVIA Health Care"
                style={{ height:"52px", width:"auto", display:"block", position:"relative", zIndex:1 }} />
            </div>
          </div>

          {/* Textes */}
          <div style={{ fontSize:11,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",
            color:"rgba(125,211,252,0.6)",marginBottom:10,
            animation:"_slideUp 0.5s ease 0.15s both" }}>
            Ressources Humaines
          </div>

          <h1 style={{ fontSize:36,fontWeight:800,margin:"0 0 28px",lineHeight:1.15,
            background:"linear-gradient(135deg,#e0f2fe 0%,#bae6fd 45%,#93c5fd 100%)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
            animation:"_slideUp 0.5s ease 0.25s both" }}>
            Connexion en cours…
          </h1>

          {/* Dots */}
          <div style={{ display:"flex",gap:12,animation:"_slideUp 0.5s ease 0.4s both" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width:  dot===i ? 14 : 9,
                height: dot===i ? 14 : 9,
                borderRadius:"50%",
                background: dot===i
                  ? "linear-gradient(135deg,#38bdf8,#818cf8)"
                  : "rgba(56,189,248,0.22)",
                boxShadow: dot===i ? "0 0 14px rgba(56,189,248,0.8)" : "none",
                transition:"all 0.28s cubic-bezier(0.34,1.56,0.64,1)",
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
