"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle, XCircle, Camera, Loader2, AlertCircle } from "lucide-react"

// Page publique — pas d'authentification requise
// Scannée via QR code central à l'entrée

type Phase = "loading" | "detecting" | "identified" | "success" | "error"

interface EmployeMatch {
  id: string
  prenom: string
  nom: string
  photoUrl?: string
  score: number
}

declare global {
  interface Window {
    faceapi: any
  }
}

export default function EntreePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [message, setMessage] = useState("Chargement des modèles…")
  const [match, setMatch] = useState<EmployeMatch | null>(null)
  const [pointageId, setPointageId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const modelsLoaded = useRef(false)

  useEffect(() => {
    loadFaceApi()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function loadFaceApi() {
    // Charge face-api.js depuis le CDN
    if (!window.faceapi) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script")
        s.src = "/face-api.min.js"
        s.onload = () => resolve()
        s.onerror = () => reject(new Error("Impossible de charger face-api.js"))
        document.head.appendChild(s)
      })
    }

    const faceapi = window.faceapi
    setMessage("Chargement modèles de reconnaissance…")

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ])
      modelsLoaded.current = true
      setMessage("Démarrage de la caméra…")
      await startCamera()
    } catch (err) {
      setError("Erreur lors du chargement des modèles de reconnaissance faciale")
      setPhase("error")
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play()
          setPhase("detecting")
          setMessage("Placez votre visage devant la caméra")
          startDetection()
        }
      }
    } catch {
      setError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.")
      setPhase("error")
    }
  }

  async function startDetection() {
    const faceapi = window.faceapi

    // Récupère les descripteurs de tous les employés
    const res = await fetch("/api/pointage/face")
    const employes: { id: string; prenom: string; nom: string; photoUrl?: string; descriptor: number[] }[] = await res.json()

    if (employes.length === 0) {
      setError("Aucun employé enregistré avec une empreinte faciale. Contactez le RH.")
      setPhase("error")
      return
    }

    const labeledDescriptors = employes.map(e =>
      new faceapi.LabeledFaceDescriptors(e.id, [new Float32Array(e.descriptor)])
    )
    const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5)

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || phase === "success") return

      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor()

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (!detections) return

      // Dessine le rectangle de détection
      const box = detections.detection.box
      ctx.strokeStyle = "#38bdf8"
      ctx.lineWidth = 3
      ctx.strokeRect(box.x, box.y, box.width, box.height)

      const result = matcher.findBestMatch(detections.descriptor)

      if (result.label !== "unknown") {
        const employeMatch = employes.find(e => e.id === result.label)
        if (employeMatch) {
          clearInterval(intervalRef.current!)
          streamRef.current?.getTracks().forEach(t => t.stop())

          setMatch({ ...employeMatch, score: result.distance })
          await enregistrerEntree(employeMatch.id, result.distance)
        }
      }
    }, 700)
  }

  async function enregistrerEntree(employeId: string, faceScore: number) {
    setPhase("identified")
    setMessage("Identité confirmée — enregistrement…")

    try {
      const res = await fetch("/api/pointage/entree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeId, faceScore }),
      })
      const data = await res.json()
      setPointageId(data.pointageId)
      setPhase("success")
    } catch {
      setError("Erreur lors de l'enregistrement du pointage")
      setPhase("error")
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", background: "linear-gradient(135deg,#020817 0%,#0c1a3d 50%,#0f2560 100%)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",
      padding: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Orbes */}
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(14,165,233,0.2) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: 450, height: 450, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(129,140,248,0.18) 0%,transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 60, height: 60, borderRadius: 18,
          background: "linear-gradient(135deg,#38bdf8,#1e40af)",
          boxShadow: "0 0 40px rgba(56,189,248,0.5)", marginBottom: 16,
        }}>
          <Camera size={28} color="white" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", margin: 0 }}>Pointage d'entrée</h1>
        <p style={{ color: "rgba(148,163,184,0.8)", fontSize: 13, marginTop: 6 }}>
          Reconnaissance faciale automatique
        </p>
      </div>

      {/* Zone caméra */}
      {(phase === "detecting" || phase === "identified") && (
        <div style={{ position: "relative", marginBottom: 24, borderRadius: 20, overflow: "hidden",
          boxShadow: "0 0 0 3px rgba(56,189,248,0.4), 0 20px 60px rgba(0,0,0,0.5)" }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: 320, height: 240, display: "block", borderRadius: 20, background: "#000" }} />
          <canvas ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: 320, height: 240, pointerEvents: "none" }} />

          {/* Coins stylisés */}
          {[["0,0","tl"],["calc(100% - 20px),0","tr"],["0,calc(100% - 20px)","bl"],["calc(100% - 20px),calc(100% - 20px)","br"]].map(([pos, key]) => {
            const [left, top] = pos.split(",")
            const iR = key.includes("r")
            const iB = key.includes("b")
            return (
              <div key={key} style={{
                position: "absolute", left, top, width: 20, height: 20,
                borderTop: iB ? "none" : "3px solid #38bdf8",
                borderBottom: iB ? "3px solid #38bdf8" : "none",
                borderLeft: iR ? "none" : "3px solid #38bdf8",
                borderRight: iR ? "3px solid #38bdf8" : "none",
              }} />
            )
          })}
        </div>
      )}

      {/* États */}
      {phase === "loading" && (
        <div style={{ textAlign: "center" }}>
          <Loader2 size={40} color="#38bdf8" style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <p style={{ color: "#94a3b8", fontSize: 14 }}>{message}</p>
        </div>
      )}

      {phase === "detecting" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            color: "#7dd3fc", fontSize: 14, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8",
              animation: "pulse 1.5s ease-in-out infinite" }} />
            Analyse en cours…
          </div>
          <p style={{ color: "#475569", fontSize: 12 }}>Restez face à la caméra</p>
        </div>
      )}

      {phase === "identified" && (
        <div style={{ textAlign: "center" }}>
          <Loader2 size={24} color="#38bdf8" style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
          <p style={{ color: "#7dd3fc", fontSize: 14 }}>{message}</p>
        </div>
      )}

      {phase === "success" && match && (
        <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease both" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <CheckCircle size={64} color="#22c55e" strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: "0 0 4px" }}>
            Bonjour, {match.prenom} !
          </h2>
          <p style={{ color: "#86efac", fontSize: 14, marginBottom: 24 }}>
            Pointage enregistré à {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>

          {/* Box info */}
          <div style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: 16, padding: "20px 32px", marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>Confiance de reconnaissance</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#38bdf8" }}>
              {Math.round((1 - match.score) * 100)}%
            </div>
          </div>

          <div style={{
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 12, padding: "14px 24px", color: "#86efac", fontSize: 13,
          }}>
            Rendez-vous dans votre atelier et scannez le QR code affiché
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ textAlign: "center" }}>
          <XCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
          <p style={{ color: "#fca5a5", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {error || "Une erreur est survenue"}
          </p>
          <button
            onClick={() => { setPhase("loading"); setError(""); loadFaceApi() }}
            style={{
              marginTop: 16, padding: "10px 24px", borderRadius: 10,
              background: "linear-gradient(135deg,#38bdf8,#6366f1)",
              color: "white", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
            }}>
            Réessayer
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
