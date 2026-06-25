"use client"

import { SessionProvider } from "next-auth/react"
import { AppProgressBar } from "next-nprogress-bar"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      {children}
      <AppProgressBar
        height="3px"
        color="#6366f1"
        options={{ showSpinner: false, easing: "ease", speed: 200 }}
        shallowRouting
      />
    </SessionProvider>
  )
}
