"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-200 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm font-medium group"
    >
      <LogOut className="h-4 w-4 flex-shrink-0" />
      Se déconnecter
    </button>
  )
}
