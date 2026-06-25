"use client"

import { useRef, useState, useEffect } from "react"
import { Camera, X, CheckCircle, Loader2, ScanFace } from "lucide-react"

declare global {
  interface Window { faceapi: any }
}

interface Props {
  employeId: string
  hasFace: boolean
}

export function FaceEnrollButton({ employeId, hasFace }: Props) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "capturing" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      setPhase("idle")
    }
  }, [open])

  async function openModal() {
    setOpen(true)
    setPhase("loading")
    setMessage("Chargement modèles…")

    if (!window.faceapi) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script")
        s.src = "/face-api.min.js"
        s.onload = () => resolve()
        s.onerror = () => reject()
        document.head.appendChild(s)
      }).catch(() => {
        setPhase("error")
        setMessage("Impossible de charger face-api.js")
        return
      })
    }

    try {
      const faceapi = window.faceapi
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ])

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      setPhase("ready")
      setMessage("Cliquez sur 'Capturer' pour enregistrer le visage")

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      setPhase("error")
      setMessage("Erreur d'accès à la caméra ou chargement des modèles")
    }
  }

  async function capture() {
    if (!videoRef.current || phase !== "ready") return
    setPhase("capturing")
    setMessage("Analyse du visage…")

    const faceapi = window.faceapi
    const detections = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor()

    if (!detections) {
      setPhase("ready")
      setMessage("Aucun visage détecté — restez face à la caméra")
      return
    }

    const descriptor = Array.from(detections.descriptor) as number[]

    const res = await fetch("/api/pointage/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId, descriptor }),
    })

    if (res.ok) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      setPhase("done")
      setMessage("Empreinte faciale enregistrée avec succès !")
    } else {
      setPhase("error")
      setMessage("Erreur lors de l'enregistrement")
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
        style={hasFace
          ? { background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.25)", color: "#16a34a" }
          : { background: "rgba(56,189,248,0.08)", borderColor: "rgba(56,189,248,0.25)", color: "#0284c7" }}>
        <ScanFace size={16} />
        {hasFace ? "Mettre à jour le visage" : "Enregistrer le visage"}
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "white", borderRadius: 24, padding: 32, maxWidth: 440, width: "100%",
            boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reconnaissance faciale</h2>
                <p className="text-sm text-slate-500 mt-0.5">Enregistrement de l'empreinte</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Vidéo */}
            <div style={{ position: "relative", borderRadius: 16, overflow: "hidden",
              background: "#0f172a", marginBottom: 20 }}>
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
              {phase === "loading" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", flexDirection: "column", gap: 12 }}>
                  <Loader2 size={32} color="#38bdf8" style={{ animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>{message}</p>
                </div>
              )}
              {phase === "done" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
                  <CheckCircle size={52} color="#22c55e" strokeWidth={1.5} />
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 text-center mb-5">{message}</p>

            {phase === "done" ? (
              <button onClick={() => { setOpen(false); window.location.reload() }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                Fermer
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  Annuler
                </button>
                <button onClick={capture} disabled={phase !== "ready"}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)" }}>
                  {phase === "capturing" ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
                  {phase === "capturing" ? "Analyse…" : "Capturer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
