"use client"

import { useState, useEffect } from "react"

export function DateDisplay() {
  const [label, setLabel] = useState("")

  useEffect(() => {
    setLabel(
      new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    )
  }, [])

  if (!label) return null

  return <span className="text-xs text-slate-400">{label}</span>
}
