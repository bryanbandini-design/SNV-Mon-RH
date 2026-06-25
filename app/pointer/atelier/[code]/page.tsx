"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle, XCircle, Camera, Loader2, MapPin } from "lucide-react"
import { use } from "react"

type Phase = "loading" | "detecting" | "identified" | "success" | "error"

interface EmployeMatch {
  id: string
  prenom: string
  nom: string
  score: number
}

interface AtelierInfo {
  id: string
  nom: string
  code: string
  couleur: string
}

declare global {
  interface Window {
    faceapi: any
  }
}

export default function AtelierPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [message, setMessage] = useState("Chargement…")
  const [match, setMatch] = useState<EmployeMatch | null>(null)
  const [atelier, setAtelier] = useState<AtelierInfo | null>(null)
  const [error, setError] = useState("")
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    init()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function init() {
    // Vérifier l'atelier
    try {
      const res = await fetch("/api/ateliers")
      const list: AtelierInfo[] = await res.json()
      const found = list.find(a => a.code === code.toUpperCase())
      if (!found) {
        setError(`QR code invalide : atelier "${code}" introuvable`)
        setPhase("error")
        return
      }
      setAtelier(found)
    } catch {
      setError("Impossible de contacter le serveur")
      setPhase("error")
      return
    }

    await loadFaceApi()
  }

  async function loadFaceApi() {
    if (!window.faceapi) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script")
        s.src = "/face-api.min.js"
        s.onload = () => resolve()
        s.onerror = () => reject()
        document.head.appendChild(s)
      })
    }

    setMessage("Chargement reconnaissance faciale…")
    try {
      const faceapi = window.faceapi
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ])
      setMessage("Démarrage caméra…")
      await startCamera()
    } catch {
      setError("Erreur de chargement des modèles")
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
          setMessage("Regardez la caméra pour confirmer votre présence")
          startDetection()
        }
      }
    } catch {
      setError("Impossible d'accéder à la caméra")
      setPhase("error")
    }
  }

  async function startDetection() {
    const faceapi = window.faceapi
    const res = await fetch("/api/pointage/face")
    const employes: { id: string; prenom: string; nom: string; descriptor: number[] }[] = await res.json()

    if (employes.length === 0) {
      setError("Aucune empreinte faciale enregistrée dans le système")
      setPhase("error")
      return
    }

    const labeledDescriptors = employes.map(e =>
      new faceapi.LabeledFaceDescriptors(e.id, [new Float32Array(e.descriptor)])
    )
    const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5)

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return

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

      const box = detections.detection.box
      ctx.strokeStyle = "#a78bfa"
      ctx.lineWidth = 3
      ctx.strokeRect(box.x, box.y, box.width, box.height)

      const result = matcher.findBestMatch(detections.descriptor)
      if (result.label !== "unknown") {
        const found = employes.find(e => e.id === result.label)
        if (found) {
          clearInterval(intervalRef.current!)
          streamRef.current?.getTracks().forEach(t => t.stop())
          setMatch({ ...found, score: result.distance })
          await confirmerPresence(found.id, result.distance)
        }
      }
    }, 700)
  }

  async function confirmerPresence(employeId: string, faceScore: number) {
    setPhase("identified")
    setMessage("Identité confirmée — confirmation de présence…")

    try {
      const res = await fetch("/api/pointage/confirmer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atelierCode: code.toUpperCase(), faceScore, employeId }),
      })
      const data = await res.json()
      if (data.success) {
        setPhase("success")
      } else {
        setError(data.error ?? "Erreur lors de la confirmation")
        setPhase("error")
      }
    } catch {
      setError("Erreur de connexion au serveur")
      setPhase("error")
    }
  }

  const accentColor = atelier?.couleur ?? "#a78bfa"

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", background: "linear-gradient(135deg,#020817 0%,#0d0d26 50%,#130826 100%)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",
      padding: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Orbes couleur atelier */}
      <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 450, height: 450, borderRadius: "50%",
        background: `radial-gradient(circle,${accentColor}33 0%,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(56,189,248,0.15) 0%,transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 60, height: 60, borderRadius: 18,
          background: `linear-gradient(135deg,${accentColor},#1e40af)`,
          boxShadow: `0 0 40px ${accentColor}66`, marginBottom: 16,
        }}>
          <MapPin size={28} color="white" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: 0 }}>
          {atelier ? atelier.nom : "Pointage atelier"}
        </h1>
        <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 13, marginTop: 6 }}>
          Confirmation de présence
        </p>
      </div>

      {/* Zone caméra */}
      {(phase === "detecting" || phase === "identified") && (
        <div style={{ position: "relative", marginBottom: 24, borderRadius: 20, overflow: "hidden",
          boxShadow: `0 0 0 3px ${accentColor}66, 0 20px 60px rgba(0,0,0,0.5)` }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: 320, height: 240, display: "block", borderRadius: 20, background: "#000" }} />
          <canvas ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: 320, height: 240, pointerEvents: "none" }} />
          {/* Coins */}
          {[["0","0","tl"],["calc(100% - 20px)","0","tr"],["0","calc(100% - 20px)","bl"],["calc(100% - 20px)","calc(100% - 20px)","br"]].map(([l, t, k]) => (
            <div key={k} style={{
              position: "absolute", left: l, top: t, width: 20, height: 20,
              borderTop: k.includes("b") ? "none" : `3px solid ${accentColor}`,
              borderBottom: k.includes("b") ? `3px solid ${accentColor}` : "none",
              borderLeft: k.includes("r") ? "none" : `3px solid ${accentColor}`,
              borderRight: k.includes("r") ? `3px solid ${accentColor}` : "none",
            }} />
          ))}
        </div>
      )}

      {/* États */}
      {phase === "loading" && (
        <div style={{ textAlign: "center" }}>
          <Loader2 size={40} color={accentColor} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <p style={{ color: "#94a3b8", fontSize: 14 }}>{message}</p>
        </div>
      )}

      {phase === "detecting" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            color: "#c4b5fd", fontSize: 14, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor,
              animation: "pulse 1.5s ease-in-out infinite" }} />
            Analyse en cours…
          </div>
          <p style={{ color: "#475569", fontSize: 12 }}>Restez face à la caméra</p>
        </div>
      )}

      {phase === "identified" && (
        <div style={{ textAlign: "center" }}>
          <Loader2 size={24} color={accentColor} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
          <p style={{ color: "#c4b5fd", fontSize: 14 }}>{message}</p>
        </div>
      )}

      {phase === "success" && match && atelier && (
        <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease both" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <CheckCircle size={64} color="#22c55e" strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: "0 0 4px" }}>
            Présence confirmée !
          </h2>
          <p style={{ color: "#86efac", fontSize: 14, marginBottom: 24 }}>
            {match.prenom} — {atelier.nom} — {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>

          <div style={{
            background: "rgba(255,255,255,0.05)", border: `1px solid ${accentColor}33`,
            borderRadius: 16, padding: "20px 32px",
          }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>Fiabilité</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: accentColor }}>
              {Math.round((1 - match.score) * 100)}%
            </div>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ textAlign: "center" }}>
          <XCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
          <p style={{ color: "#fca5a5", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{error}</p>
          <button
            onClick={() => { setPhase("loading"); setError(""); init() }}
            style={{
              marginTop: 16, padding: "10px 24px", borderRadius: 10,
              background: `linear-gradient(135deg,${accentColor},#1e40af)`,
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
