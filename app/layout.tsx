import type { Metadata, Viewport } from "next"
import { Providers } from "./providers"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "SANOVIA RH",
  description: "Plateforme de gestion des ressources humaines — SANOVIA Health Care",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1a3461",
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
