import type { Metadata } from "next"
import { Providers } from "./providers"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mon RH",
  description: "Plateforme de gestion des ressources humaines",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full">
        <Providers>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  )
}
