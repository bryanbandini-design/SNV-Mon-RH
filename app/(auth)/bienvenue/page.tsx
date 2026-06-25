"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"

// ── Citations motivantes ──────────────────────────────────────────────────────

const QUOTES = [
  { text: "Le succès, c'est aller d'échec en échec sans perdre son enthousiasme.", author: "Winston Churchill" },
  { text: "La seule façon de faire du bon travail, c'est d'aimer ce que vous faites.", author: "Steve Jobs" },
  { text: "Chaque matin est une nouvelle chance de faire quelque chose de remarquable.", author: "Anonyme" },
  { text: "Ne comptez pas les jours, faites que les jours comptent.", author: "Muhammad Ali" },
  { text: "Le talent, c'est d'avoir envie de faire quelque chose.", author: "Julien Green" },
  { text: "La qualité n'est jamais un accident. C'est toujours le résultat d'un effort intelligent.", author: "John Ruskin" },
  { text: "Votre attitude au travail détermine votre altitude dans la vie.", author: "Zig Ziglar" },
  { text: "La différence entre l'ordinaire et l'extraordinaire, c'est ce petit supplément d'effort.", author: "Jimmy Johnson" },
  { text: "Chaque expert a un jour été un débutant. Commencez.", author: "Helen Hayes" },
  { text: "Le travail en équipe divise la tâche et multiplie le succès.", author: "Anonyme" },
  { text: "Les grandes choses ne se font jamais seul, mais par une équipe de personnes.", author: "Steve Jobs" },
  { text: "Ce que vous faites aujourd'hui peut améliorer tous vos lendemains.", author: "Ralph Marston" },
  { text: "La motivation vous fait démarrer, l'habitude vous fait continuer.", author: "Jim Ryun" },
  { text: "Peu importe le rythme, l'essentiel est d'avancer.", author: "Confucius" },
  { text: "Le secret du succès, c'est la constance dans l'objectif.", author: "Benjamin Disraeli" },
  { text: "Croire que quelque chose est impossible, c'est le rendre impossible.", author: "Earl Nightingale" },
  { text: "Votre seule limite est vous-même. Dépassez-vous chaque jour.", author: "Anonyme" },
  { text: "Une belle journée commence par une belle attitude.", author: "Anonyme" },
  { text: "Le meilleur moment pour agir, c'est maintenant.", author: "Proverbe chinois" },
  { text: "Ensemble, nous pouvons aller plus loin que tout seul.", author: "Henry Ford" },
]

// ── Particules flottantes ─────────────────────────────────────────────────────

interface Particle {
  id: number
  x: number
  y: number
  size: number
  color: string
  duration: number
  delay: number
  opacity: number
}

function generateParticles(n: number): Particle[] {
  const colors = ["38bdf8", "60a5fa", "818cf8", "a78bfa", "7dd3fc", "93c5fd", "c4b5fd"]
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 5 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    duration: Math.random() * 5 + 4,
    delay: Math.random() * 4,
    opacity: Math.random() * 0.5 + 0.15,
  }))
}

// ── Composant principal ───────────────────────────────────────────────────────

const DURATION_MS = 4500

export default function BienvenuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [quote]     = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [particles] = useState(() => generateParticles(22))
  const [progress,  setProgress]  = useState(0)
  const [phase,     setPhase]     = useState<"hidden" | "logo" | "title" | "quote" | "bar">("hidden")

  const startRef = useRef<number | null>(null)

  // Prénom seulement (premier mot du nom)
  const prenom = session?.user?.name?.split(" ")[0] ?? "vous"

  // Déclenche le countdown une fois la session connue
  useEffect(() => {
    if (status === "loading") return

    // Entrée progressive
    const t1 = setTimeout(() => setPhase("logo"),  80)
    const t2 = setTimeout(() => setPhase("title"), 400)
    const t3 = setTimeout(() => setPhase("quote"), 900)
    const t4 = setTimeout(() => setPhase("bar"),   1300)

    // Barre de progression
    startRef.current = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? Date.now())
      const pct = Math.min((elapsed / DURATION_MS) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(tick)
        router.push("/")
        router.refresh()
      }
    }, 40)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearInterval(tick) }
  }, [status, router])

  return (
    <>
      {/* Keyframes CSS */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0px);   opacity: var(--op); }
          50%  { transform: translateY(-18px); opacity: var(--op); }
          100% { transform: translateY(0px);   opacity: var(--op); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes rotateSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes typing {
          from { width: 0; }
          to   { width: 100%; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #020817 0%, #0c1a3d 45%, #0f2560 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glows */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "-10%", left: "-5%",
            width: 600, height: 600, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", bottom: "-10%", right: "-5%",
            width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(129,140,248,0.2) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56,189,248,0.09) 0%, transparent 70%)",
          }} />
        </div>

        {/* Particules */}
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: `#${p.color}`,
              opacity: p.opacity,
              ["--op" as string]: p.opacity,
              animation: `floatUp ${p.duration}s ease-in-out ${p.delay}s infinite`,
              pointerEvents: "none",
              filter: "blur(0.5px)",
            }}
          />
        ))}

        {/* Carte centrale */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            padding: "56px 64px 48px",
            maxWidth: 560,
            width: "100%",
            textAlign: "center",
          }}
        >
          {/* Badge logo avec anneaux pulsants */}
          <div
            style={{
              position: "relative",
              marginBottom: 36,
              opacity: phase === "hidden" ? 0 : 1,
              animation: phase !== "hidden" ? "popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
            }}
          >
            {/* Anneaux pulsants */}
            {[0, 0.4, 0.8].map((delay, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: -20 - i * 8,
                  borderRadius: 28 + i * 4,
                  border: `1.5px solid rgba(56,189,248,${0.5 - i * 0.12})`,
                  animation: `pulseRing 2.4s ease-out ${delay}s infinite`,
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Badge */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 22,
                background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #1e40af 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                boxShadow: "0 0 40px rgba(56,189,248,0.55), 0 8px 32px rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.2)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Shimmer sur le badge */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                backgroundSize: "400px 100%",
                animation: "shimmer 2.5s linear infinite",
              }} />
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "white", position: "relative" }} />
              <div style={{
                width: 34, height: 18, borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
                background: "rgba(255,255,255,0.92)", position: "relative",
              }} />
            </div>
          </div>

          {/* Bienvenue + Prénom */}
          <div
            style={{
              marginBottom: 12,
              opacity: 0,
              animation: phase === "title" || phase === "quote" || phase === "bar"
                ? "fadeSlideUp 0.6s ease-out 0s forwards"
                : "none",
            }}
          >
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(125,211,252,0.7)",
              marginBottom: 8,
            }}>
              Mon RH
            </div>
            <h1 style={{
              fontSize: 42,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 40%, #93c5fd 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "none",
            }}>
              Bienvenue,<br />
              <span style={{
                background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {prenom} !
              </span>
            </h1>
          </div>

          {/* Sous-titre */}
          <p
            style={{
              fontSize: 15,
              color: "rgba(148,163,184,0.75)",
              margin: "0 0 36px",
              opacity: 0,
              animation: phase === "title" || phase === "quote" || phase === "bar"
                ? "fadeSlideUp 0.6s ease-out 0.1s forwards"
                : "none",
            }}
          >
            Prêt·e pour une excellente journée ?
          </p>

          {/* Séparateur */}
          <div
            style={{
              width: "100%",
              height: 1,
              marginBottom: 32,
              opacity: 0,
              animation: phase === "quote" || phase === "bar"
                ? "fadeSlideUp 0.5s ease-out forwards"
                : "none",
              background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.3), rgba(129,140,248,0.3), transparent)",
            }}
          />

          {/* Citation */}
          <div
            style={{
              opacity: 0,
              animation: phase === "quote" || phase === "bar"
                ? "fadeSlideUp 0.6s ease-out 0.05s forwards"
                : "none",
              marginBottom: 40,
              padding: "0 8px",
            }}
          >
            <div style={{ fontSize: 28, color: "rgba(56,189,248,0.6)", marginBottom: 6, lineHeight: 1 }}>"</div>
            <p style={{
              fontSize: 15,
              fontStyle: "italic",
              lineHeight: 1.7,
              color: "rgba(203,213,225,0.85)",
              margin: "0 0 14px",
            }}>
              {quote.text}
            </p>
            <p style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "rgba(125,211,252,0.6)",
              textTransform: "uppercase",
            }}>
              — {quote.author}
            </p>
          </div>

          {/* Barre de progression */}
          <div
            style={{
              width: "100%",
              opacity: 0,
              animation: phase === "bar"
                ? "fadeSlideUp 0.4s ease-out forwards"
                : "none",
            }}
          >
            <div style={{
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 2,
                background: "linear-gradient(90deg, #0ea5e9, #38bdf8, #818cf8)",
                boxShadow: "0 0 10px rgba(56,189,248,0.6)",
                transition: "width 0.04s linear",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                  backgroundSize: "200px 100%",
                  animation: "shimmer 1.2s linear infinite",
                }} />
              </div>
            </div>
            <p style={{
              marginTop: 10,
              fontSize: 11,
              color: "rgba(100,116,139,0.6)",
              letterSpacing: "0.05em",
            }}>
              Redirection vers le tableau de bord…
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
